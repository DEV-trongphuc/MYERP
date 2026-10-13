import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ShieldCheck, Sparkles, Users, 
  CheckCircle2, Lock, Cpu, ChevronRight, Info
} from 'lucide-react';
import { type SpecializedAgent, SPECIALIZED_AGENTS } from '../../constants/aiAgents';
import { pushOverlay } from '../../utils/overlayStack';

interface AgentDetailModalProps {
  isOpen: boolean;
  agent: SpecializedAgent | null;
  onClose: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  isOpen,
  agent,
  onClose,
  onSelectPrompt
}) => {
  const [overrideAgent, setOverrideAgent] = useState<SpecializedAgent | null>(null);

  // Sync state if prop changes or modal re-opens
  useEffect(() => {
    setOverrideAgent(null);
  }, [agent, isOpen]);

  // Handle escape key and overlay stacking
  useEffect(() => {
    if (isOpen) {
      const unregister = pushOverlay('agent-detail-modal', onClose, 2300);
      return () => unregister();
    }
  }, [isOpen, onClose]);

  const currentAgent = overrideAgent || agent;

  if (!isOpen || !currentAgent) return null;

  const collaboratingAgents = (currentAgent.synergyWith || [])
    .map(id => SPECIALIZED_AGENTS.find(a => a.id === id))
    .filter(Boolean) as SpecializedAgent[];

  return createPortal(
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2147483647,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '90vh',
            background: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header Banner with Agent Mascot */}
          <div style={{
            position: 'relative',
            padding: '20px 24px',
            background: `linear-gradient(135deg, ${currentAgent.badgeBg} 0%, #ffffff 100%)`,
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}>
            {/* Mascot Avatar with theme glow */}
            <div style={{
              position: 'relative',
              width: 68,
              height: 68,
              borderRadius: '18px',
              background: '#ffffff',
              border: `2.5px solid ${currentAgent.badgeColor}`,
              boxShadow: `0 8px 20px -4px ${currentAgent.badgeColor}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              flexShrink: 0
            }}>
              <img
                src={currentAgent.avatar}
                alt={currentAgent.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <span style={{
                position: 'absolute',
                bottom: -3,
                right: -3,
                width: 13,
                height: 13,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: '2px solid #ffffff'
              }} title="Sẵn sàng phục vụ" />
            </div>

            {/* Title & Badge */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: currentAgent.badgeBg,
                  color: currentAgent.badgeColor,
                  border: `1px solid ${currentAgent.badgeColor}33`
                }}>
                  {currentAgent.badge}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  color: '#64748b',
                  fontWeight: 650,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Cpu size={12} color="#64748b" />
                  SI Swarm Agent
                </span>
              </div>

              <h2 style={{
                fontSize: '1.24rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                lineHeight: 1.2
              }}>
                {currentAgent.name}
              </h2>
              <p style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: currentAgent.badgeColor,
                margin: '3px 0 0 0'
              }}>
                {currentAgent.roleTitle}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                borderRadius: '10px',
                padding: '7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#fee2e2';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Đóng modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body: 2-Column Grid Layout */}
          <div style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '20px',
            alignItems: 'start'
          }}>
            {/* ═══ CỘT 1: GIỚI THIỆU & QUYỀN HẠN CHUYÊN MÔN ═══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Mission Statement */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                fontSize: '0.86rem',
                color: '#334155',
                lineHeight: 1.55,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <Info size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Nhiệm vụ chuyên trách: </strong>
                  {currentAgent.description}
                </div>
              </div>

              {/* Permissions (Zero-Trust RBAC) */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  marginBottom: '10px'
                }}>
                  <ShieldCheck size={18} color="#059669" />
                  <span>Quyền Hạn & Thẩm Quyền Can Thiệp (Zero-Trust RBAC)</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: '#fafbfc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '12px',
                  padding: '14px 16px'
                }}>
                  {currentAgent.permissions.map((perm, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '9px',
                      fontSize: '0.82rem',
                      color: '#334155',
                      lineHeight: 1.45
                    }}>
                      <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{perm}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Quick Prompt (Text Only - No Button) */}
              {currentAgent.suggestedPrompt && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '12px 14px'
                }}>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: 750,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    letterSpacing: '0.5px',
                    marginBottom: '6px'
                  }}>
                    💡 Câu lệnh mẫu gợi ý:
                  </div>
                  <div style={{
                    fontSize: '0.84rem',
                    fontWeight: 650,
                    color: '#1e293b',
                    lineHeight: 1.45,
                    fontStyle: 'italic'
                  }}>
                    "{currentAgent.suggestedPrompt}"
                  </div>
                </div>
              )}
            </div>

            {/* ═══ CỘT 2: LIÊN MINH & RANH GIỚI AN TOÀN ═══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Security Boundaries & Human-in-the-loop */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '14px 16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#b45309',
                  marginBottom: '8px'
                }}>
                  <Lock size={15} color="#d97706" />
                  <span>Ranh Giới An Toàn & Quyền Hạn Cuối Cùng</span>
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: '18px',
                  fontSize: '0.8rem',
                  color: '#92400e',
                  lineHeight: 1.55
                }}>
                  {currentAgent.securityGuardrails.map((guard, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{guard}</li>
                  ))}
                  <li style={{ marginTop: '6px' }}>
                    <strong>Quyền hạn chốt: </strong>Agent chỉ hỗ trợ điền sẵn Thẻ Hành Động. Người dùng bắt buộc phải bấm nút <em>"Xác nhận / Lưu"</em> để dữ liệu chính thức được ghi vào hệ thống CSDL.
                  </li>
                </ul>
              </div>

              {/* Swarm Synergy (Collaborating Agents) */}
              {collaboratingAgents.length > 0 && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '10px'
                  }}>
                    <Users size={16} color="#7c3aed" />
                    <span>Liên Minh Phối Hợp Tự Động (Swarm Synergy)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {collaboratingAgents.map((ag) => (
                      <div
                        key={ag.id}
                        onClick={() => setOverrideAgent(ag)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '7px 11px',
                          borderRadius: '10px',
                          background: '#ffffff',
                          border: `1.5px solid ${ag.badgeColor}40`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = ag.badgeColor;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = `${ag.badgeColor}40`;
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        title={`Xem chi tiết ${ag.name}`}
                      >
                        <img
                          src={ag.avatar}
                          alt={ag.name}
                          style={{ width: 24, height: 24, objectFit: 'contain' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                            {ag.name}
                          </span>
                          <span style={{ fontSize: '0.66rem', color: ag.badgeColor, fontWeight: 650 }}>
                            {ag.badge}
                          </span>
                        </div>
                        <ChevronRight size={13} color="#94a3b8" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Bar */}
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              Phân quyền theo tài khoản đăng nhập (Zero-Trust)
            </span>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

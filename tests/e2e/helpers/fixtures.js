/**
 * tests/e2e/helpers/fixtures.js
 * Authoritative test fixtures derived from PROJECT.md and ORIGINAL_REQUEST.md
 */

export const USERS = {
  superAdmin: { id: 1, user_id: 1, name: 'Super Admin', role: 'super_admin', tenant_id: 1 },
  admin: { id: 2, user_id: 2, name: 'System Admin', role: 'admin', tenant_id: 1 },
  director: { id: 3, user_id: 3, name: 'Managing Director', role: 'director', tenant_id: 1 },
  manager: { id: 4, user_id: 4, name: 'Sales Manager', role: 'manager', tenant_id: 1 },
  marketing: { id: 5, user_id: 5, name: 'Marketing Specialist', role: 'marketing', tenant_id: 1 },
  accountant: { id: 6, user_id: 6, name: 'Chief Accountant', role: 'accountant', tenant_id: 1 },
  saleAlpha: { id: 10, user_id: 10, name: 'Sale Alpha', role: 'sale', tenant_id: 1 },
  saleBeta: { id: 11, user_id: 11, name: 'Sale Beta', role: 'sale', tenant_id: 1 },
  outsiderTenant: { id: 99, user_id: 99, name: 'Outsider User', role: 'sale', tenant_id: 999 }
};

export const MARKETING_ROUTES = [
  '/marketing',
  '/marketing/flows',
  '/marketing/campaigns',
  '/marketing/templates',
  '/marketing/audience',
  '/marketing/surveys',
  '/marketing/vouchers',
  '/marketing/social-bot',
  '/marketing/ai-training',
  '/marketing/web-tracking',
  '/marketing/api-triggers'
];

export const BRAND_DNA = {
  primaryRed: '#C6333D',
  deepRed: '#BD1D2D',
  slateDark: '#0F172A',
  slateMuted: '#334155',
  cardBorder: '1px solid #E2E8F0',
  borderRadius: 16,
  kpiIconBox: { width: 32, height: 32, borderRadius: 8 },
  palette: ['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#475569', '#FB7185', '#94A3B8', '#1E293B', '#CBD5E1']
};

export const REPORT_REASONS = [
  { id: 'invalid_phone', label: 'Sai số điện thoại / Số ảo' },
  { id: 'duplicate_mine', label: 'Trùng của tôi (< 6 tháng)' },
  { id: 'duplicate_other', label: 'Trùng của Sale khác' },
  { id: 'spam_junk', label: 'Spam ảo / Junk lead' },
  { id: 'unqualified', label: 'Khác / Data Unqualified' }
];

/**
 * Lead Scoring Engine - Single Source of Truth for MYERP
 * Calibrated according to Enterprise CRM standards (HubSpot / Salesforce).
 * 
 * Distribution:
 * - Demographic / Profile Fit: Maximum ~30 points (New uncontacted leads start here: Cold, 15-28 pts)
 * - Behavioral & Sales Milestones: Maximum ~70 points (Gained via calls, discovery, quotes, deposits)
 * - Decay: -15 to -25 points for untouched leads
 * 
 * Heat Tiers:
 * - Hot (Rất Nóng): >= 80 pts (Red #ef4444)
 * - Warm (Tiềm Năng): 40 - 79 pts (Amber #f59e0b)
 * - Cold (Lạnh / Mới): 0 - 39 pts (Blue #3b82f6)
 */

export interface LeadScoringRules {
  // Demographic / Profile (Target: Max ~30 pts)
  base_score: number;
  phone: number;
  mobile: number;
  both_phones: number;
  email: number;
  project_id: number;
  company_id: number;
  industry: number;
  title_c_level: number;
  title_other: number;
  customer_type: number;
  gender: number;
  birthday: number;
  address: number;
  social_link: number;
  source_referral: number;
  source_website: number;
  budget_range: number;

  // Behavioral & Sales Milestones (Target: Max ~70 pts)
  stage_contact_attempted: number;
  stage_connected: number;
  stage_discovery: number;
  stage_program_matched: number;
  stage_proposal_sent: number;
  stage_application: number;
  stage_deposit: number;
  ttl1_completed: number;
  status_qualified_customer: number;
  revenue_high: number;
  revenue_medium: number;
  win_prob_high: number;
  notes_long: number;
  has_tags: number;

  // Decay
  decay_no_interaction: number;
  [key: string]: number;
}

export const DEFAULT_LEAD_SCORING_RULES: LeadScoringRules = {
  // Demographic / Profile (Max ~30 pts)
  base_score: 0,
  phone: 10,
  mobile: 5,
  both_phones: 5,
  email: 5,
  project_id: 5,
  company_id: 3,
  industry: 2,
  title_c_level: 5,
  title_other: 2,
  customer_type: 2,
  gender: 1,
  birthday: 2,
  address: 3,
  social_link: 2,
  source_referral: 10,
  source_website: 5,
  budget_range: 5,

  // Behavioral & Sales Milestones (Max ~70 pts)
  stage_contact_attempted: 10,
  stage_connected: 10,
  stage_discovery: 10,
  stage_program_matched: 10,
  stage_proposal_sent: 10,
  stage_application: 10,
  stage_deposit: 15,
  ttl1_completed: 10,
  status_qualified_customer: 10,
  revenue_high: 15,
  revenue_medium: 10,
  win_prob_high: 5,
  notes_long: 5,
  has_tags: 3,

  // Decay
  decay_no_interaction: -15
};

export interface ScoreRuleBreakdownItem {
  rule: string;
  pts: number;
  type: 'Demographic' | 'Behavioral' | 'Decay' | 'System';
  desc?: string;
}

export interface LeadScoreResult {
  score: number;
  demographicScore: number;
  behavioralScore: number;
  decayScore: number;
  rules: ScoreRuleBreakdownItem[];
  heatTier: 'hot' | 'warm' | 'cold';
  heatLabel: string;
  heatColor: string;
  heatBg: string;
}

/**
 * Returns unified heat tier, label, and colors from a score.
 */
export const getLeadHeatTier = (score: number): {
  tier: 'hot' | 'warm' | 'cold';
  label: string;
  color: string;
  bg: string;
} => {
  const safeScore = Math.min(100, Math.max(0, Math.round(score || 0)));
  if (safeScore >= 80) {
    return { tier: 'hot', label: 'Rất Nóng', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
  }
  if (safeScore >= 40) {
    return { tier: 'warm', label: 'Tiềm Năng', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
  }
  return { tier: 'cold', label: 'Lạnh', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
};

/**
 * Calculate full Lead Score with dual-axis calibration
 */
export const calculateLeadScore = (
  c: any,
  rulesConfig?: any,
  decayDays: number = 5,
  activities?: any[]
): LeadScoreResult => {
  if (!c) {
    return {
      score: 0,
      demographicScore: 0,
      behavioralScore: 0,
      decayScore: 0,
      rules: [],
      heatTier: 'cold',
      heatLabel: 'Lạnh',
      heatColor: '#3b82f6',
      heatBg: 'rgba(59, 130, 246, 0.1)'
    };
  }

  const r: LeadScoringRules = {
    ...DEFAULT_LEAD_SCORING_RULES,
    ...(rulesConfig || {})
  };

  let demographicScore = 0;
  let behavioralScore = 0;
  let decayScore = 0;
  const breakdown: ScoreRuleBreakdownItem[] = [];

  // 0. Base score (System)
  const basePts = Number(r.base_score ?? 0);
  if (basePts !== 0) {
    demographicScore += basePts;
    breakdown.push({
      rule: 'Điểm khởi tạo',
      pts: basePts,
      type: 'System',
      desc: 'Điểm cơ bản cho mỗi liên hệ mới'
    });
  }

  // --- TRỤC 1: DEMOGRAPHIC / HỒ SƠ (Max ~30 pts) ---

  // Phone contacts
  if (c.phone) {
    const pts = Number(r.phone ?? 10);
    demographicScore += pts;
    breakdown.push({ rule: 'Có số điện thoại chính', pts, type: 'Demographic', desc: 'Có số điện thoại để liên hệ' });
  }
  if (c.mobile || c.phone2) {
    const pts = Number(r.mobile ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Có số điện thoại phụ', pts, type: 'Demographic', desc: 'Có số thứ hai dự phòng' });
  }
  if (c.phone && (c.mobile || c.phone2)) {
    const pts = Number(r.both_phones ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Cung cấp cả 2 số liên hệ', pts, type: 'Demographic', desc: 'Độ tin cậy liên lạc cao' });
  }

  // Email
  if (c.email) {
    const pts = Number(r.email ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Cung cấp Email liên hệ', pts, type: 'Demographic' });
  }

  // Job Title / C-Level
  const title = (c.job_title || '').toLowerCase();
  if (title.includes('giám đốc') || title.includes('ceo') || title.includes('sáng lập') || title.includes('founder') || title.includes('chủ tịch') || title.includes('quản lý') || title.includes('manager')) {
    const pts = Number(r.title_c_level ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Chức danh Quản lý / C-Level', pts, type: 'Demographic', desc: 'Có quyền ra quyết định' });
  } else if (title) {
    const pts = Number(r.title_other ?? 2);
    demographicScore += pts;
    breakdown.push({ rule: 'Có thông tin chức vụ', pts, type: 'Demographic' });
  }

  // Course / Project of interest
  if (c.project_id || c.program) {
    const pts = Number(r.project_id ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Đã xác định chương trình quan tâm', pts, type: 'Demographic' });
  }

  // Source
  const src = (c.source || '').toLowerCase();
  if (src === 'referral' || src === 'gioi_thieu' || src === 'alumni') {
    const pts = Number(r.source_referral ?? 10);
    demographicScore += pts;
    breakdown.push({ rule: 'Nguồn được Giới thiệu (Referral)', pts, type: 'Demographic', desc: 'Nguồn chất lượng cao' });
  } else if (src === 'website' || src === 'inbound') {
    const pts = Number(r.source_website ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Nguồn Inbound từ Website', pts, type: 'Demographic' });
  }

  // Address / Location
  if (c.address || c.city || c.preferred_location) {
    const pts = Number(r.address ?? 3);
    demographicScore += pts;
    breakdown.push({ rule: 'Có thông tin địa chỉ / khu vực', pts, type: 'Demographic' });
  }

  // Other Demographics
  if (c.company_id || c.company || c.company_name) {
    const pts = Number(r.company_id ?? 3);
    demographicScore += pts;
    breakdown.push({ rule: 'Có liên kết công ty / tổ chức', pts, type: 'Demographic' });
  }
  if (c.industry) {
    const pts = Number(r.industry ?? 2);
    demographicScore += pts;
    breakdown.push({ rule: 'Xác định ngành nghề công tác', pts, type: 'Demographic' });
  }
  if (c.budget_range || c.budget) {
    const pts = Number(r.budget_range ?? 5);
    demographicScore += pts;
    breakdown.push({ rule: 'Xác định phân khúc ngân sách', pts, type: 'Demographic' });
  }
  if (c.zalo_link || c.fb_link || c.facebook_link) {
    const pts = Number(r.social_link ?? 2);
    demographicScore += pts;
    breakdown.push({ rule: 'Có liên kết Zalo / Facebook', pts, type: 'Demographic' });
  }
  if (c.birthday || c.dob) {
    const pts = Number(r.birthday ?? 2);
    demographicScore += pts;
    breakdown.push({ rule: 'Có thông tin ngày sinh', pts, type: 'Demographic' });
  }
  if (c.customer_type) {
    const pts = Number(r.customer_type ?? 2);
    demographicScore += pts;
    breakdown.push({ rule: 'Xác định loại khách hàng', pts, type: 'Demographic' });
  }
  if (c.gender) {
    const pts = Number(r.gender ?? 1);
    demographicScore += pts;
    breakdown.push({ rule: 'Có thông tin giới tính', pts, type: 'Demographic' });
  }

  // --- TRỤC 2: BEHAVIORAL / HÀNH VI & TIẾN ĐỘ BÁN HÀNG (Max ~70 pts) ---

  const stageId = Number(c.stage_id) || 0;
  const stageSlug = (c.pipeline_status || '').toLowerCase();
  const hasContacted = Boolean(c.last_contact || c.last_interaction_at || stageId >= 32);

  // 1. Contact attempted (Stage >= 32 or slug or last_contact)
  if (hasContacted || stageSlug === 'contact_attempted' || stageId === 32) {
    const pts = Number(r.stage_contact_attempted ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Đã thực hiện liên hệ / gọi điện', pts, type: 'Behavioral', desc: 'Sale đã tiếp cận chủ động' });
  }

  // 2. Connected / In Conversation (Stage >= 33)
  if (stageId >= 33 || stageSlug === 'connected' || stageSlug === 'da_ket_noi') {
    const pts = Number(r.stage_connected ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Đã bắt máy / kết nối thành công', pts, type: 'Behavioral', desc: 'Khách hàng lắng nghe tư vấn' });
  }

  // 3. Discovery Completed / Needed (Stage >= 34)
  if (stageId >= 34 || stageSlug === 'needed' || stageSlug === 'discovery_completed' || stageSlug === 'kham_pha_nhu_cau') {
    const pts = Number(r.stage_discovery ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Khám phá nhu cầu thành công', pts, type: 'Behavioral', desc: 'Đã nắm rõ mong muốn của học viên' });
  }

  // 4. Program Matched (Stage >= 36)
  if (stageId >= 36 || stageSlug === 'program_matched' || stageSlug === 'ghep_chuong_trinh') {
    const pts = Number(r.stage_program_matched ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Đã ghép lớp & lịch học phù hợp', pts, type: 'Behavioral', desc: 'Khớp khung giờ rảnh' });
  }

  // 5. Proposal / Quotation Sent (Stage >= 37)
  if (stageId >= 37 || stageSlug === 'proposal_sent' || stageSlug === 'gui_bao_gia' || Number(c.open_deal_value) > 0) {
    const pts = Number(r.stage_proposal_sent ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Đã gửi báo giá / lộ trình học', pts, type: 'Behavioral', desc: 'Khách đang cân nhắc chi phí' });
  }

  // 6. Application Started / Completed (Stage >= 39)
  if (stageId >= 39 || stageSlug === 'application_started' || stageSlug === 'application_completed' || stageSlug === 'offer_accepted') {
    const pts = Number(r.stage_application ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Bắt đầu nộp hồ sơ / Đăng ký', pts, type: 'Behavioral', desc: 'Cam kết tham gia khóa học' });
  }

  // 7. Deposit / Tuition / Enrolled (Stage >= 43)
  if (stageId >= 43 || stageSlug === 'deposit_tuition_payment' || stageSlug === 'enrolled' || stageSlug === 'hoc_vien' || c.status === 'customer') {
    const pts = Number(r.stage_deposit ?? 15);
    behavioralScore += pts;
    breakdown.push({ rule: 'Đã đặt cọc giữ chỗ / Đóng học phí', pts, type: 'Behavioral', desc: 'Chuyển đổi thành công' });
  }

  // TTL1 Meeting Condition Verified
  if (Number(c.ttl1_completed) === 1) {
    const pts = Number(r.ttl1_completed ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Hoàn thành xác minh gặp gỡ (TTL1)', pts, type: 'Behavioral' });
  }

  // Status qualified
  if (c.status === 'qualified' || c.status === 'customer') {
    const pts = Number(r.status_qualified_customer ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Xác nhận trạng thái Khách hàng Tiềm Năng', pts, type: 'Behavioral' });
  }

  // Revenue & Deal Value
  const revenue = Number(c.expected_revenue) || Number(c.open_deal_value) || 0;
  if (revenue > 500000000) {
    const pts = Number(r.revenue_high ?? 15);
    behavioralScore += pts;
    breakdown.push({ rule: 'Giá trị giao dịch lớn (> 500 Triệu)', pts, type: 'Behavioral' });
  } else if (revenue > 100000000) {
    const pts = Number(r.revenue_medium ?? 10);
    behavioralScore += pts;
    breakdown.push({ rule: 'Giá trị giao dịch trung bình (> 100 Triệu)', pts, type: 'Behavioral' });
  }

  if (Number(c.win_probability) > 70) {
    const pts = Number(r.win_prob_high ?? 5);
    behavioralScore += pts;
    breakdown.push({ rule: 'Xác suất chốt giao dịch cao (> 70%)', pts, type: 'Behavioral' });
  }

  // Rich notes / conversation insights
  if (c.notes && c.notes.trim().length > 15) {
    const pts = Number(r.notes_long ?? 5);
    behavioralScore += pts;
    breakdown.push({ rule: 'Có ghi chú chi tiết nhu cầu', pts, type: 'Behavioral' });
  }

  // Tags
  const tagList = typeof c.tags === 'string'
    ? c.tags.split(',').filter(Boolean)
    : (Array.isArray(c.tags) ? c.tags : []);
  if (tagList.length > 0) {
    const pts = Number(r.has_tags ?? 3);
    behavioralScore += pts;
    breakdown.push({ rule: 'Đã gắn thẻ phân loại (Tags)', pts, type: 'Behavioral' });
  }

  // --- TRỤC 3: DECAY / RỚT NHIỆT DO BỎ BÊ ---
  let lastInteractionTime = c.last_contact || c.last_interaction_at || c.updated_at || c.created_at;
  if (activities && activities.length > 0) {
    const latestAct = activities.reduce((latest, current) => {
      const latestTime = new Date(latest.created_at).getTime();
      const currTime = new Date(current.created_at).getTime();
      return currTime > latestTime ? current : latest;
    }, activities[0]);
    if (latestAct?.created_at) {
      lastInteractionTime = latestAct.created_at;
    }
  }

  if (lastInteractionTime) {
    const msDiff = Date.now() - new Date(lastInteractionTime).getTime();
    const daysDiff = msDiff / (1000 * 60 * 60 * 24);
    if (daysDiff > (decayDays || 5)) {
      const pts = Number(r.decay_no_interaction ?? -15);
      decayScore += pts;
      breakdown.push({
        rule: `Rớt nhiệt do quá ${Math.floor(daysDiff)} ngày không tương tác`,
        pts,
        type: 'Decay',
        desc: 'Sale cần gọi lại chăm sóc gấp để hâm nóng'
      });
    }
  }

  const rawTotal = demographicScore + behavioralScore + decayScore;
  const finalScore = Math.min(100, Math.max(0, rawTotal));
  const heatInfo = getLeadHeatTier(finalScore);

  return {
    score: finalScore,
    demographicScore: Math.max(0, demographicScore),
    behavioralScore: Math.max(0, behavioralScore),
    decayScore,
    rules: breakdown,
    heatTier: heatInfo.tier,
    heatLabel: heatInfo.label,
    heatColor: heatInfo.color,
    heatBg: heatInfo.bg
  };
};

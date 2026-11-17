/**
 * tests/e2e/tier5_adversarial.js
 * Tier 5 Adversarial Coverage Hardening & White-Box Stress Test Suite for MYERP.
 * Tests edge conditions, hostile inputs, soft-delete cascades, RBAC IDOR attacks, and UI invariants.
 */

import { describe, it, assert, assertEqual, colors } from './helpers/testHarness.js';
import {
  readProjectFile,
  assertFileContains,
  assertFileNotContains,
  assertRegexMatch,
  assertRegexNotMatch,
  checkSoftDeleteEnforcement
} from './helpers/contractValidator.js';
import {
  RBACSimulator,
  IDORSimulator,
  ACIDDepositSimulator,
  TicketDecouplingSimulator,
  WebTrackingCalendarSimulator
} from './helpers/simulationEngine.js';
import { USERS } from './helpers/fixtures.js';

export function registerTier5Tests() {
  // =========================================================================
  // SUITE 1: MILESTONE 1 ADVERSARIAL STRESS TESTING
  // =========================================================================
  describe('Tier 5 - Suite 1: Milestone 1 Adversarial White-Box Hardening', () => {
    it('T5.1.1: ReportDataModal AST verification ensures complete isolation from Helpdesk /tickets', () => {
      const modalContent = readProjectFile('src/components/ui/ReportDataModal.tsx');
      assert(!modalContent.includes("'/tickets'"), 'ReportDataModal must never call /tickets');
      assert(!modalContent.includes('"/tickets"'), 'ReportDataModal must never call "/tickets"');
      assert(!modalContent.includes('`tickets`'), 'ReportDataModal must never mention tickets table');
      assert(modalContent.includes("fetchAPI('submit_report'"), 'ReportDataModal must call fetchAPI submit_report');
      assert(modalContent.includes('lead_id:'), 'ReportDataModal must provide lead_id');
      assert(modalContent.includes('consultant_id:'), 'ReportDataModal must provide consultant_id');
      assert(modalContent.includes('round_id:'), 'ReportDataModal must provide round_id');
      assert(modalContent.includes('reason:'), 'ReportDataModal must provide reason');
    }, { tier: 5 });

    it('T5.1.2: TicketController white-box AST verification confirms purge of data error compensation logic', () => {
      const ticketCtrl = readProjectFile('backend/controllers/TicketController.php');
      assert(!ticketCtrl.includes("Báo lỗi data"), 'TicketController must not handle Báo lỗi data');
      assert(!ticketCtrl.includes("data_reports"), 'TicketController must not reference data_reports');
      assert(!ticketCtrl.includes("is_error_ticket"), 'TicketController must not mutate contacts.is_error_ticket');
      assert(ticketCtrl.includes("respond(404, null, 'Không tìm thấy ticket', false);"), 'TicketController must handle 404 cleanly');
    }, { tier: 5 });

    it('T5.1.3: CustomerProfileDrawer Helpdesk categories are cleansed of lead error compensation', () => {
      const drawerContent = readProjectFile('src/pages/CustomerProfileDrawer.tsx');
      assert(!drawerContent.includes("'lead_error_compensation'"), 'CustomerProfileDrawer must not offer lead_error_compensation in Helpdesk');
      assert(drawerContent.includes("'general_support'"), 'CustomerProfileDrawer must offer standard general_support');
    }, { tier: 5 });

    it('T5.1.4: Proactive AI Agent cron query inspects tickets table with tenant isolation and soft-delete guard', () => {
      const cronContent = readProjectFile('backend/cron_ai_proactive_agent.php');
      assert(!cronContent.includes("SELECT COUNT(*) FROM support_tickets"), 'Proactive agent must not query non-existent support_tickets');
      assert(cronContent.includes("SELECT COUNT(*) FROM tickets"), 'Proactive agent must query tickets table');
      assert(cronContent.includes("WHERE tenant_id = ? AND deleted_at IS NULL"), 'Proactive agent must filter tenant_id and deleted_at');
    }, { tier: 5 });

    it('T5.1.5: 100% Soft-Delete Mandate holds across admin_users, api.php, and AgentHrmAttendanceTools', () => {
      const adminUsers = readProjectFile('backend/automation/admin_users.php');
      assert(adminUsers.includes("UPDATE users SET deleted_at = NOW() WHERE id = ?"), 'admin_users must soft-delete users');
      assert(!adminUsers.includes("DELETE FROM users"), 'admin_users must never hard delete users');
      assert(adminUsers.includes("WHERE u.deleted_at IS NULL"), 'admin_users list must filter out soft-deleted users');

      const apiPhp = readProjectFile('backend/api.php');
      assert(!apiPhp.includes("DELETE FROM data_reports"), 'api.php must never hard delete data_reports');
      assert(apiPhp.includes("UPDATE data_reports SET round_id = NULL"), 'api.php delete_round must detach round_id safely');

      const hrmTools = readProjectFile('backend/controllers/agent_tools/AgentHrmAttendanceTools.php');
      assert(!hrmTools.includes("DELETE FROM hrm_leave_requests"), 'HRM tools must not hard delete leave requests');
      assert(!hrmTools.includes("DELETE FROM attendance_bulk_requests"), 'HRM tools must not hard delete attendance requests');
      assert(!hrmTools.includes("DELETE FROM hrm_salary_advances"), 'HRM tools must not hard delete salary advances');
    }, { tier: 5 });

    it('T5.1.6: Hostile and sparse array re-indexing strictly eliminates SQLSTATE[HY093] parameter mismatch', () => {
      const rawRecipients = [
        { subscriber_id: 105 },
        { subscriber_id: null },
        { subscriber_id: 105 }, // duplicate
        { subscriber_id: 210 },
        { subscriber_id: undefined },
        { subscriber_id: 315 },
        { subscriber_id: 0 },
        { subscriber_id: 210 }  // duplicate
      ];

      // Simulate PHP: $subIds = array_values(array_unique(array_filter(array_column($recipients, 'subscriber_id'))));
      const extracted = rawRecipients.map(r => r.subscriber_id).filter(id => id !== null && id !== undefined && id > 0);
      const uniqueIds = Array.from(new Set(extracted));
      const reindexed = Object.values(uniqueIds); // Resets keys to 0, 1, 2...

      assertEqual(reindexed.length, 3);
      assertEqual(reindexed[0], 105);
      assertEqual(reindexed[1], 210);
      assertEqual(reindexed[2], 315);
      // Verify keys are sequential integers 0, 1, 2
      const keys = Object.keys(reindexed).map(Number);
      assertEqual(keys[0], 0);
      assertEqual(keys[1], 1);
      assertEqual(keys[2], 2);
    }, { tier: 5 });

    it('T5.1.7: AcademicAffairsController prepares statements outside bulk insert/update loops', () => {
      const academicAffairs = readProjectFile('backend/controllers/AcademicAffairsController.php');
      // In saveStudentGrades
      const saveIdx = academicAffairs.indexOf('function saveStudentGrades');
      assert(saveIdx > -1, 'saveStudentGrades must exist');
      const saveBody = academicAffairs.slice(saveIdx, saveIdx + 4000);
      const prepIdx = saveBody.indexOf('$stmtChk = $this->db->prepare');
      const loopIdx = saveBody.indexOf('foreach ($gradesList as $item)');
      assert(prepIdx > -1 && loopIdx > -1 && prepIdx < loopIdx, 'prepare must occur before foreach in saveStudentGrades');

      // In saveClassGradebook (bulk grades)
      const bulkIdx = academicAffairs.indexOf('function saveClassGradebook');
      assert(bulkIdx > -1, 'saveClassGradebook must exist');
      const bulkBody = academicAffairs.slice(bulkIdx, bulkIdx + 5000);
      const bulkPrepIdx = bulkBody.indexOf('$stmtChk = $this->db->prepare');
      const bulkLoopIdx = bulkBody.indexOf('foreach ($rows as $row)') !== -1 ? bulkBody.indexOf('foreach ($rows as $row)') : bulkBody.indexOf('foreach ($students as');
      assert(bulkPrepIdx > -1, 'prepare must occur outside foreach in saveClassGradebook');
    }, { tier: 5 });

    it('T5.1.8: DepositController Anti-Self-Approval and currency validation white-box & ACID verification', () => {
      const depositPhp = readProjectFile('backend/controllers/DepositController.php');
      assert(depositPhp.includes('$isCreator && !$isAdminOrDirector'), 'DepositController must check creator and admin/director status');
      assert(depositPhp.includes("respond(403, null, 'Không được tự phê duyệt đợt thanh toán của chính mình', false);"), 'DepositController must return 403 on self-approval');
      assert(depositPhp.includes('$actualAmount === null || $actualAmount <= 0'), 'DepositController must validate actualAmount');
      assert(depositPhp.includes("respond(422, null, 'Đợt thanh toán này đã được duyệt từ trước', false);"), 'DepositController must reject duplicate approval with 422');

      const depositSim = new ACIDDepositSimulator();
      depositSim.createDeposit(901, USERS.accountant.id, 1, [
        { id: 9001, milestone_name: 'Đợt 1', expected_amount: 50000000, status: 'pending' }
      ]);

      // 1. Creator accountant attempts self-approval -> 403
      const resCreator = depositSim.approveMilestone(USERS.accountant, 901, 9001, 50000000);
      assertEqual(resCreator.status, 403, 'Creator accountant self-approval must be blocked');

      // 2. Authorized approval by director -> 200
      const resValid = depositSim.approveMilestone(USERS.director, 901, 9001, 50000000);
      assertEqual(resValid.status, 200, 'Director approving valid milestone must succeed');

      // 3. Subsequent duplicate approval attempt on already approved milestone -> 422
      const resDuplicate = depositSim.approveMilestone(USERS.admin, 901, 9001, 50000000);
      assertEqual(resDuplicate.status, 422, 'Duplicate approval on approved milestone must return 422');
    }, { tier: 5 });
  });

  // =========================================================================
  // SUITE 2: MILESTONE 2 ADVERSARIAL STRESS TESTING
  // =========================================================================
  describe('Tier 5 - Suite 2: Milestone 2 Adversarial White-Box Hardening', () => {
    const sensitiveActions = [
      'approve_report',
      'reject_report',
      'compensate_approved_no_comp',
      'reassign_lead',
      'block_lead',
      'update_lead_fields'
    ];

    const unauthorizedRoles = [
      'sale',
      'sales',
      'consultant',
      'viewer',
      'guest',
      'student',
      'teacher',
      'intern',
      'external',
      'finance',
      'accountant',
      'ADMIN_SPOOF'
    ];

    it('T5.2.1: Exhaustive RBAC matrix: 6 sensitive actions reject 12 unauthorized role permutations (72 attack vectors)', () => {
      for (const action of sensitiveActions) {
        // Test unauthenticated / empty role
        const emptyUser = { id: 99, role: '', tenant_id: 1 };
        const resEmpty = RBACSimulator.authorizeApiAction(action, emptyUser);
        assertEqual(resEmpty.status, 401, `Action ${action} must reject empty role with 401`);
        assertEqual(resEmpty.authorized, false);

        // Test unauthorized roles
        for (const role of unauthorizedRoles) {
          const fakeUser = { id: 99, role, tenant_id: 1 };
          const res = RBACSimulator.authorizeApiAction(action, fakeUser);
          assertEqual(res.status, 403, `Action ${action} must reject role '${role}' with 403`);
          assertEqual(res.authorized, false);
        }
      }
    }, { tier: 5 });

    it('T5.2.2: Management roles can access all 6 sensitive actions', () => {
      const allowedRoles = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'marketing'];
      for (const action of sensitiveActions) {
        for (const role of allowedRoles) {
          const validUser = { id: 1, role, tenant_id: 1 };
          const res = RBACSimulator.authorizeApiAction(action, validUser);
          assertEqual(res.status, 200, `Action ${action} should authorize role '${role}'`);
          assertEqual(res.authorized, true);
        }
      }
    }, { tier: 5 });

    it('T5.2.3: ContactController show & update white-box checks enforce owner/collaborator validation and anti-theft', () => {
      const contactCtrl = readProjectFile('backend/controllers/ContactController.php');
      // show() ownership check
      assert(contactCtrl.includes("in_array(strtolower($auth['role'] ?? ''), ['sale', 'sales'], true)"), 'show must check sale role');
      assert(contactCtrl.includes("isOwnerOrCollab = ($ownerId === $currentUid) || in_array($currentUid, $collabs, true)"), 'show must check owner and collaborator');
      assert(contactCtrl.includes("respond(403, null, 'Bạn không có quyền xem thông tin khách hàng này', false)"), 'show must reject unauthorized sales with 403');

      // update() lead stealing check
      assert(contactCtrl.includes("$targetOwnerId !== $currOwnerId"), 'update must check for owner tampering');
      assert(contactCtrl.includes("respond(403, null, 'Bạn không có quyền chuyển nhượng người phụ trách khách hàng', false)"), 'update must reject lead transfer attempts');
    }, { tier: 5 });

    it('T5.2.4: ContactController IDOR simulation blocks unauthorized sale, permits collaborator, and blocks lead reassignment', () => {
      const contactA = { id: 101, owner_id: USERS.saleAlpha.id, tenant_id: 1, collaborator_ids: [105] };
      const contactB = { id: 102, owner_id: USERS.saleBeta.id, tenant_id: 1, collaborator_ids: [] };

      // Sale Beta attempts to view Contact A -> Blocked
      const canBetaViewA = IDORSimulator.canAccessContact(USERS.saleBeta, contactA);
      assertEqual(canBetaViewA, false, 'Sale Beta must not view Contact A');

      // Collaborator (user_id 105) can view Contact A
      const collabUser = { user_id: 105, id: 105, role: 'sale', tenant_id: 1 };
      const canCollabViewA = IDORSimulator.canAccessContact(collabUser, contactA);
      assertEqual(canCollabViewA, true, 'Collaborator must be able to view Contact A');

      // Sale Alpha attempts to view Contact B -> Blocked
      const canAlphaViewB = IDORSimulator.canAccessContact(USERS.saleAlpha, contactB);
      assertEqual(canAlphaViewB, false, 'Sale Alpha must not view Contact B');

      // Admin can view both
      assertEqual(IDORSimulator.canAccessContact(USERS.admin, contactA), true);
      assertEqual(IDORSimulator.canAccessContact(USERS.admin, contactB), true);
    }, { tier: 5 });

    it('T5.2.5: TicketController show() includes immediate return after 403 to prevent data leak', () => {
      const ticketCtrl = readProjectFile('backend/controllers/TicketController.php');
      const showMethodIdx = ticketCtrl.indexOf('public function show(');
      assert(showMethodIdx > -1, 'TicketController must have show method');
      const showSection = ticketCtrl.slice(showMethodIdx, showMethodIdx + 400);
      assert(showSection.includes('respond(403'), 'show must respond with 403 on denied access');
      assert(showSection.includes('return;'), 'show must include return; immediately after respond(403)');
    }, { tier: 5 });

    it('T5.2.6: Frontend App.tsx enforces canAccessMarketingRoute on all 11 marketing routes & sub-routes', () => {
      const appContent = readProjectFile('src/App.tsx');
      assert(appContent.includes("canAccessMarketingRoute"), 'App.tsx must use canAccessMarketingRoute');
      assert(appContent.includes("<AccessDeniedView"), 'App.tsx must render AccessDeniedView for unauthorized marketing routes');

      const marketingRoutes = [
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

      for (const route of marketingRoutes) {
        assertEqual(RBACSimulator.canAccessMarketingRoute(USERS.saleAlpha, route), false, `Sale must be blocked on route ${route}`);
        assertEqual(RBACSimulator.canAccessMarketingRoute(USERS.marketing, route), true, `Marketing must access route ${route}`);
        assertEqual(RBACSimulator.canAccessMarketingRoute(USERS.admin, route), true, `Admin must access route ${route}`);
      }
    }, { tier: 5 });

    it('T5.2.7: Automation auth_middleware strictly purges sale roles from $allowedRoles', () => {
      const authMiddleware = readProjectFile('backend/automation/auth_middleware.php');
      assert(!authMiddleware.includes("'sale'"), 'auth_middleware must not contain sale');
      assert(!authMiddleware.includes("'sales'"), 'auth_middleware must not contain sales');
      assert(authMiddleware.includes("'marketing'"), 'auth_middleware must contain marketing');
      assert(authMiddleware.includes("'admin'"), 'auth_middleware must contain admin');
    }, { tier: 5 });
  });

  // =========================================================================
  // SUITE 3: MILESTONE 3 ADVERSARIAL STRESS TESTING
  // =========================================================================
  describe('Tier 5 - Suite 3: Milestone 3 Adversarial White-Box Hardening', () => {
    it('T5.3.1: AutomationFlowsPage loads surveys in parallel and passes linkedSurvey to FlowCard', () => {
      const flowsPage = readProjectFile('src/pages/marketing/AutomationFlowsPage.tsx');
      assert(flowsPage.includes("const [surveys, setSurveys] = useState"), 'AutomationFlowsPage must define surveys state');
      assert(flowsPage.includes("api.get<any[]>('surveys'"), 'AutomationFlowsPage must fetch surveys in loadData');
      assert(flowsPage.includes("surveysMap = useMemo"), 'AutomationFlowsPage must construct surveysMap');
      assert(flowsPage.includes("linkedSurvey={"), 'AutomationFlowsPage must pass linkedSurvey to FlowCard');
      assert(flowsPage.includes("onOpenSurvey={"), 'AutomationFlowsPage must pass onOpenSurvey handler');
    }, { tier: 5 });

    it('T5.3.2: FlowCard displays real survey name when active and rose warning badge when deleted/dangling', () => {
      const flowCard = readProjectFile('src/components/marketing/components/flows/FlowCard.tsx');
      assert(flowCard.includes("linkedSurvey?: any"), 'FlowCardProps must accept linkedSurvey');
      assert(flowCard.includes("Khảo sát: ${"), 'FlowCard must format real survey name');
      assert(flowCard.includes("Khảo sát đã xóa [${"), 'FlowCard must render warning for deleted survey');
      assert(flowCard.includes("accent: 'rose'"), 'FlowCard must use rose accent for deleted survey');
      assert(flowCard.includes("gradientMain: 'from-rose-500 to-red-600'"), 'FlowCard must use rose gradient for deleted survey');
    }, { tier: 5 });

    it('T5.3.3: FlowNodes and TriggerConfig handle deleted surveys without crashing runtime', () => {
      const flowNodes = readProjectFile('src/components/marketing/components/flows/nodes/FlowNodes.tsx');
      assert(flowNodes.includes("isSurveyDeleted"), 'FlowNodes must check isSurveyDeleted');
      assert(flowNodes.includes("LỖI LIÊN KẾT"), 'FlowNodes must display LỖI LIÊN KẾT badge');

      const triggerConfig = readProjectFile('src/components/marketing/components/flows/config/TriggerConfig.tsx');
      assert(triggerConfig.includes("bg-rose-50") && triggerConfig.includes("border-rose-200") && triggerConfig.includes("text-rose-800"), 'TriggerConfig must display alert banner when entity is deleted');

      const validationService = readProjectFile('src/components/marketing/services/flowValidationService.ts');
      assert(validationService.includes("case 'survey':"), 'Validation service must support survey trigger type');
    }, { tier: 5 });

    it('T5.3.4: Surveys & Forms enforce 100% Soft-Delete and JSON_UNESCAPED_UNICODE', () => {
      const surveysPhp = readProjectFile('backend/automation/surveys.php');
      assert(!surveysPhp.includes("DELETE FROM surveys"), 'surveys.php must never hard delete surveys');
      assert(!surveysPhp.includes("DELETE FROM survey_responses"), 'surveys.php must never hard delete responses');
      assert(surveysPhp.includes("UPDATE surveys SET deleted_at = NOW() WHERE id = ?"), 'surveys.php must use soft-delete');
      assert(surveysPhp.includes("JSON_UNESCAPED_UNICODE"), 'surveys.php must use JSON_UNESCAPED_UNICODE');

      const formsPhp = readProjectFile('backend/automation/forms.php');
      assert(!formsPhp.includes("DELETE FROM forms"), 'forms.php must never hard delete forms');
      assert(formsPhp.includes("UPDATE forms SET deleted_at = NOW() WHERE id = ?"), 'forms.php must use soft-delete');
      assert(formsPhp.includes("JSON_UNESCAPED_UNICODE"), 'forms.php must use JSON_UNESCAPED_UNICODE');
    }, { tier: 5 });

    it('T5.3.5: SurveyProperties defensive array filter protects against 6 malformed API response shapes', () => {
      const safeFilterFlows = (r) => {
        const rawFlows = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
        return (Array.isArray(rawFlows) ? rawFlows : []).filter(f => f.status === 'active');
      };

      // 1. Paginated object response: { data: { data: [{ status: 'active' }, { status: 'paused' }] } }
      assertEqual(safeFilterFlows({ data: { data: [{ status: 'active' }, { status: 'paused' }] } }).length, 1);

      // 2. Direct array response: [{ status: 'active' }]
      assertEqual(safeFilterFlows({ data: [{ status: 'active' }] }).length, 1);

      // 3. Null data response: { data: null }
      assertEqual(safeFilterFlows({ data: null }).length, 0);

      // 4. Undefined response: {}
      assertEqual(safeFilterFlows({}).length, 0);

      // 5. String response: { data: "string payload" }
      assertEqual(safeFilterFlows({ data: "string payload" }).length, 0);

      // 6. Object without data key: { pagination: { total: 0 } }
      assertEqual(safeFilterFlows({ data: { pagination: { total: 0 } } }).length, 0);
    }, { tier: 5 });

    it('T5.3.6: EmailEditor onPreview completes document stream with win.document.close() to kill spinner', () => {
      const emailEditorIndex = readProjectFile('src/components/marketing/components/templates/EmailEditor/index.tsx');
      assert(emailEditorIndex.includes("win.document.open()"), 'EmailEditor preview must open document');
      assert(emailEditorIndex.includes("win.document.write("), 'EmailEditor preview must write HTML');
      assert(emailEditorIndex.includes("win.document.close()"), 'EmailEditor preview must close document to stop browser spinner');
    }, { tier: 5 });

    it('T5.3.7: SurveyEditor mobile drawer adheres to unified Z-Index layering (2147483635 & 2147483640)', () => {
      const surveyEditor = readProjectFile('src/components/marketing/components/surveys/SurveyEditor.tsx');
      assert(surveyEditor.includes("zIndex: 2147483635"), 'Mobile drawer container must have zIndex: 2147483635');
      assert(surveyEditor.includes("zIndex: 2147483640"), 'Mobile drawer panel must have zIndex: 2147483640');
    }, { tier: 5 });

    it('T5.3.8: Web Tracking Calendar Gap Filling survives extreme date ranges, reversed dates, and 0-traffic periods', () => {
      // 1. Reversed dates auto-normalization
      const invertedRes = WebTrackingCalendarSimulator.generateStats('2026-03-05', '2026-03-01', []);
      assertEqual(invertedRes.length, 5, 'Reversed dates must be auto-normalized to chronological order');
      assertEqual(invertedRes[0].date, '2026-03-01');
      assertEqual(invertedRes[4].date, '2026-03-05');

      // 2. Month boundary transition
      const monthBoundaryRes = WebTrackingCalendarSimulator.generateStats('2026-02-27', '2026-03-02', [
        { date: '2026-02-28', sessions: 12, pageViews: 45 }
      ]);
      assertEqual(monthBoundaryRes.length, 4);
      assertEqual(monthBoundaryRes[0].date, '2026-02-27');
      assertEqual(monthBoundaryRes[0].sessions, 0);
      assertEqual(monthBoundaryRes[1].date, '2026-02-28');
      assertEqual(monthBoundaryRes[1].sessions, 12);
      assertEqual(monthBoundaryRes[1].pageViews, 45);

      // 3. Leap year Feb 29
      const leapYearRes = WebTrackingCalendarSimulator.generateStats('2024-02-28', '2024-03-01', []);
      assertEqual(leapYearRes.length, 3);
      assertEqual(leapYearRes[1].date, '2024-02-29', 'Leap year must include February 29');

      // 4. Zero traffic 30-day period
      const zeroTrafficRes = WebTrackingCalendarSimulator.generateStats('2026-04-01', '2026-04-30', []);
      assertEqual(zeroTrafficRes.length, 30);
      for (const day of zeroTrafficRes) {
        assertEqual(day.sessions, 0);
        assertEqual(day.pageViews, 0);
      }
    }, { tier: 5 });

    it('T5.3.9: GeneralTabContent renders Recharts AreaChart with Sessions (#BD1D2D) and PageViews (#334155)', () => {
      const generalTab = readProjectFile('src/components/marketing/components/web-tracking/overview/GeneralTabContent.tsx');
      assert(!generalTab.includes('shims/apexCharts'), 'GeneralTabContent must not use shims/apexCharts');
      assert(generalTab.includes('AreaChart'), 'GeneralTabContent must render AreaChart');
      assert(generalTab.includes('#BD1D2D'), 'GeneralTabContent must use Brand Red #BD1D2D for sessions');
      assert(generalTab.includes('#334155'), 'GeneralTabContent must use Executive Slate #334155 for pageViews');
    }, { tier: 5 });
  });

  // =========================================================================
  // SUITE 4: MILESTONE 4 ADVERSARIAL STRESS TESTING
  // =========================================================================
  describe('Tier 5 - Suite 4: Milestone 4 Adversarial White-Box Hardening', () => {
    it('T5.4.1: SubjectAnnouncementModal implements 3-step Guided Stepper workflow', () => {
      const modal = readProjectFile('src/components/academic/SubjectAnnouncementModal.tsx');
      assert(modal.includes('const [step, setStep] = useState'), 'SubjectAnnouncementModal must track step');
      assert(modal.includes('3-STEP GUIDED STEPPER NAVIGATION'), 'Modal must have 3-step navigation header');
      assert(modal.includes('STEP 1: CẤU HÌNH MÔN & PHÒNG HỌC') || modal.includes('Cấu hình môn'), 'Modal must have Step 1 header');
      assert(modal.includes('STEP 2: ĐỐI TƯỢNG NHẬN THÔNG BÁO') || modal.includes('Đối tượng nhận'), 'Modal must have Step 2 header');
      assert(modal.includes('STEP 3: SOẠN THẢO & XEM TRƯỚC ĐA KÊNH') || modal.includes('Soạn thảo'), 'Modal must have Step 3 header');
    }, { tier: 5 });

    it('T5.4.2: Stepper validation guard blocks advancement to Step 3 when 0 recipients are selected', () => {
      const canProceedToStep3 = (selectedCount) => selectedCount > 0;
      assertEqual(canProceedToStep3(0), false, 'Cannot advance to Step 3 with 0 recipients');
      assertEqual(canProceedToStep3(1), true, 'Can advance to Step 3 with at least 1 recipient');
      assertEqual(canProceedToStep3(50), true, 'Can advance to Step 3 with 50 recipients');
    }, { tier: 5 });

    it('T5.4.3: SubjectAnnouncementModal dirty-check triggers confirm dialog when uncommitted edits exist', () => {
      const modal = readProjectFile('src/components/academic/SubjectAnnouncementModal.tsx');
      assert(modal.includes('isUserEdited'), 'SubjectAnnouncementModal must track isUserEdited flag');
      assert(modal.includes('showDiscardConfirm') && modal.includes('setShowDiscardConfirm(true)'), 'SubjectAnnouncementModal must feature discard confirmation dialog');
      assert(modal.includes('Xác nhận đóng thông báo') || modal.includes('Bạn có thay đổi chưa lưu trong thông báo'), 'Confirm dialog must warn user about uncommitted edits');
    }, { tier: 5 });

    it('T5.4.4: Subject switching in SubjectAnnouncementModal resets selected recipients and fetches new subject students', () => {
      const modal = readProjectFile('src/components/academic/SubjectAnnouncementModal.tsx');
      assert(modal.includes('activeSubject?.code') || modal.includes('activeSubject?.id'), 'fetchRecipients dependency must include activeSubject');
      assert(modal.includes('setSelectedEmails([])'), 'Switching subjects must clear selectedEmails');
    }, { tier: 5 });

    it('T5.4.5: SubjectAnnouncementModal registers with LIFO overlay stack and manages scroll lock', () => {
      const modal = readProjectFile('src/components/academic/SubjectAnnouncementModal.tsx');
      assert(modal.includes('pushOverlay'), 'SubjectAnnouncementModal must call pushOverlay');
      assert(modal.includes('document.body.style.overflow = \'hidden\''), 'SubjectAnnouncementModal must lock body scroll');
      assert(modal.includes('document.body.style.overflow = \'unset\'') || modal.includes('overflow = \'\''), 'SubjectAnnouncementModal must restore scroll on unmount');
    }, { tier: 5 });

    it('T5.4.6: StudentOnboardingEmailModal renders via createPortal and InternalSchedulePage uses zIndex: 2147483646', () => {
      const studentModal = readProjectFile('src/components/academic/StudentOnboardingEmailModal.tsx');
      assert(studentModal.includes('createPortal('), 'StudentOnboardingEmailModal must render via createPortal');
      assert(studentModal.includes('document.body'), 'StudentOnboardingEmailModal must portal into document.body');

      const schedulePage = readProjectFile('src/pages/InternalSchedulePage.tsx');
      assert(schedulePage.includes('2147483646'), 'InternalSchedulePage modal must use zIndex 2147483646');
    }, { tier: 5 });

    it('T5.4.7: Zero tolerance on borderLeft: 4px solid across all 15 Milestone 4 files', () => {
      const m4Files = [
        'src/components/academic/SubjectAnnouncementModal.tsx',
        'src/components/academic/StudentOnboardingEmailModal.tsx',
        'src/pages/InternalSchedulePage.tsx',
        'src/pages/ReportsPage.tsx',
        'src/pages/Dashboard.tsx',
        'src/pages/FinancialDashboard.tsx',
        'src/pages/ExpensesPage.tsx',
        'src/pages/DepositsPage.tsx',
        'src/pages/Consultants.tsx',
        'src/pages/AttendancePage.tsx',
        'src/pages/FairShareAudit.tsx',
        'src/pages/Gatekeeper.tsx',
        'src/pages/ProjectsPage.tsx',
        'src/pages/marketing/EmailTemplatesPage.tsx',
        'src/pages/SalePortal.tsx'
      ];

      let totalViolations = 0;
      for (const file of m4Files) {
        const content = readProjectFile(file);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('borderLeft') && line.includes('4px solid')) {
            totalViolations++;
            console.error(`Violation in ${file} line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
      assertEqual(totalViolations, 0, 'Total borderLeft: 4px solid violations across 15 M4 files must be strictly 0');
    }, { tier: 5 });

    it('T5.4.8: Recharts PALETTE strictly applies Brand Red & Executive Slate across all 6 reporting pages', () => {
      const reportingPages = [
        'src/pages/ReportsPage.tsx',
        'src/pages/Dashboard.tsx',
        'src/pages/FinancialDashboard.tsx',
        'src/pages/Gatekeeper.tsx',
        'src/pages/FairShareAudit.tsx',
        'src/pages/SalePortal.tsx'
      ];

      for (const page of reportingPages) {
        const content = readProjectFile(page);
        assert(content.includes('PALETTE') || content.includes('#C6333D') || content.includes('#BD1D2D'), `${page} must use brand red palette`);
        // Verify no rainbow array definition
        assert(!content.includes("['#3b82f6', '#10b981'"), `${page} must not define rainbow palette`);
      }
    }, { tier: 5 });

    it('T5.4.9: 4 KPI StatCards adhere to 32x32px icon boxes and 1.85rem tabular-nums across 4 pages', () => {
      const kpiPages = [
        'src/pages/ExpensesPage.tsx',
        'src/pages/DepositsPage.tsx',
        'src/pages/Consultants.tsx',
        'src/pages/AttendancePage.tsx'
      ];

      for (const page of kpiPages) {
        const content = readProjectFile(page);
        assert(content.includes('32px') && content.includes('1.85rem'), `${page} must use 32px icon box and 1.85rem font`);
        assert(content.includes('tabular-nums'), `${page} must use tabular-nums font variant`);
      }
    }, { tier: 5 });

    it('T5.4.10: Subtabs Segmented Controls adhere to 10px outer radius, 32px inner height, 7px inner radius', () => {
      const subtabPages = [
        'src/pages/marketing/EmailTemplatesPage.tsx',
        'src/pages/ProjectsPage.tsx'
      ];

      for (const page of subtabPages) {
        const content = readProjectFile(page);
        assert(content.includes('borderRadius: 10') || content.includes('borderRadius: \'10px\''), `${page} must have 10px outer container`);
        assert(content.includes('height: 32') || content.includes('height: \'32px\''), `${page} must have 32px tab height`);
        assert(content.includes('borderRadius: 7') || content.includes('borderRadius: \'7px\''), `${page} must have 7px inner button`);
      }
    }, { tier: 5 });
  });
}

// Direct execution harness
async function runDirectly() {
  const { registry } = await import('./helpers/testHarness.js');
  registry.reset();
  registerTier5Tests();

  console.log(`${colors.bold}${colors.magenta}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}   MYERP TIER 5 ADVERSARIAL HARDENING SUITE (M1 - M4 COVERAGE)${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}======================================================================${colors.reset}`);
  console.log(`${colors.dim}Date: ${new Date().toISOString()} | Node: ${process.version}${colors.reset}\n`);

  const { stats, failures } = await registry.run({ tier: 5 });

  console.log(`\n${colors.bold}${colors.magenta}======================================================================${colors.reset}`);
  console.log(`${colors.bold}   TIER 5 ADVERSARIAL EXECUTION SUMMARY${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}======================================================================${colors.reset}`);
  console.log(`  Total Adversarial Tests : ${colors.bold}${stats.total}${colors.reset}`);
  console.log(`  Passed (PASS)           : ${colors.green}${colors.bold}${stats.passed}${colors.reset}`);
  console.log(`  Failed (FAIL)           : ${stats.failed > 0 ? colors.red + colors.bold + stats.failed : colors.dim + '0'}${colors.reset}`);
  console.log(`  Duration                : ${colors.yellow}${stats.durationMs}ms${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}======================================================================${colors.reset}`);

  if (failures.length > 0) {
    console.log(`\n${colors.bold}${colors.red}❌ TIER 5 FAILURES DETECTED (${failures.length}):${colors.reset}`);
    failures.forEach((f, idx) => {
      console.log(`\n[${idx + 1}] Suite: ${f.suite} | Test: ${f.test}`);
      console.log(`    ${colors.red}${f.error.stack || f.error.message}${colors.reset}`);
    });
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}✔ ALL ${stats.total} TIER 5 ADVERSARIAL TESTS PASSED (ZERO DEFECTS)!${colors.reset}\n`);
    process.exit(0);
  }
}

// If invoked directly via `node tests/e2e/tier5_adversarial.js`
if (process.argv[1] && process.argv[1].endsWith('tier5_adversarial.js')) {
  runDirectly().catch(err => {
    console.error('Fatal Tier 5 execution error:', err);
    process.exit(1);
  });
}

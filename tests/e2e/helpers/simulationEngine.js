/**
 * tests/e2e/helpers/simulationEngine.js
 * High-fidelity business logic simulation engine for MYERP E2E Zero-Trust testing.
 * Derives behavior strictly from PROJECT.md and ORIGINAL_REQUEST.md interface contracts.
 */

export class RBACSimulator {
  static MARKETING_WHITELIST = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'marketing'];
  static REPORT_APPROVAL_WHITELIST = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'marketing'];

  static canAccessMarketingRoute(user, routePath) {
    if (!user || !user.role) return false;
    const role = String(user.role).trim().toLowerCase();
    if (role === 'sale' || role === 'consultant') return false;
    return this.MARKETING_WHITELIST.includes(role);
  }

  static authorizeApiAction(action, user) {
    if (!user || !user.role) {
      return { authorized: false, status: 401, message: 'Chưa đăng nhập' };
    }
    const role = String(user.role).trim().toLowerCase();
    const sensitiveActions = [
      'approve_report',
      'reject_report',
      'compensate_approved_no_comp',
      'reassign_lead',
      'block_lead',
      'update_lead_fields'
    ];

    if (sensitiveActions.includes(action)) {
      if (!this.REPORT_APPROVAL_WHITELIST.includes(role)) {
        return {
          authorized: false,
          status: 403,
          message: 'Bạn không có thẩm quyền thực hiện thao tác này'
        };
      }
    }
    return { authorized: true, status: 200, message: 'Thành công' };
  }
}

export class ACIDDepositSimulator {
  constructor() {
    this.deposits = new Map();
    this.milestones = new Map();
    this.auditLogs = [];
  }

  createDeposit(depositId, creatorId, tenantId, initialMilestones = []) {
    this.deposits.set(depositId, {
      id: depositId,
      created_by: creatorId,
      tenant_id: tenantId,
      status: 'pending',
      currency: 'VND',
      deleted_at: null
    });

    initialMilestones.forEach(m => {
      this.milestones.set(m.id, {
        id: m.id,
        deposit_id: depositId,
        milestone_name: m.milestone_name || 'Đợt 1',
        expected_amount: m.expected_amount || 10000000,
        actual_amount: null,
        status: m.status || 'pending',
        approved_by: null,
        approved_at: null
      });
    });
  }

  approveMilestone(auth, depositId, milestoneId, actualAmount = null) {
    const deposit = this.deposits.get(depositId);
    if (!deposit || deposit.deleted_at) {
      return { success: false, status: 404, message: 'Không tìm thấy phiếu đặt cọc' };
    }

    if (deposit.tenant_id !== auth.tenant_id) {
      return { success: false, status: 403, message: 'Sai tenant' };
    }

    const milestone = this.milestones.get(milestoneId);
    if (!milestone || milestone.deposit_id !== depositId) {
      return { success: false, status: 404, message: 'Không tìm thấy đợt thanh toán' };
    }

    if (milestone.status === 'approved') {
      return { success: false, status: 422, message: 'Đợt thanh toán này đã được duyệt từ trước' };
    }

    // Anti-Self-Approval Enforcement:
    // If the creator of the deposit attempts to approve it, and is not super admin/admin/director
    const privilegedRoles = ['admin', 'superadmin', 'super_admin', 'director'];
    const isPrivileged = privilegedRoles.includes(String(auth.role).toLowerCase());
    const isCreator = (Number(deposit.created_by) === Number(auth.user_id));

    if (isCreator && !isPrivileged) {
      return {
        success: false,
        status: 403,
        message: 'Bạn không được phép tự phê duyệt đợt thanh toán của chính mình'
      };
    }

    // Transition state atomically
    milestone.status = 'approved';
    milestone.actual_amount = actualAmount ?? milestone.expected_amount;
    milestone.approved_by = auth.user_id;
    milestone.approved_at = new Date().toISOString();

    this.auditLogs.push({
      action: 'milestone_approved',
      deposit_id: depositId,
      milestone_id: milestoneId,
      user_id: auth.user_id,
      timestamp: milestone.approved_at
    });

    return {
      success: true,
      status: 200,
      message: 'Phê duyệt đợt thanh toán thành công',
      milestone
    };
  }
}

export class TicketDecouplingSimulator {
  constructor() {
    this.dataReports = [];
    this.tickets = []; // Historical Helpdesk tickets table
  }

  seedHistoricalTickets(tickets) {
    this.tickets = [...tickets];
  }

  submitDataErrorReport(payload, callerRole = 'sale') {
    // Guarantees:
    // 1. Endpoint: POST /api.php?action=submit_report
    // 2. Writes to dataReports table
    // 3. NEVER touches tickets table
    if (!payload.lead_id && !payload.contact_id) {
      return { success: false, status: 400, message: 'Thiếu contact/lead_id' };
    }
    if (!payload.reason || typeof payload.reason !== 'string' || !payload.reason.trim()) {
      return { success: false, status: 400, message: 'Vui lòng chọn lý do báo cáo' };
    }

    const report = {
      id: this.dataReports.length + 1,
      lead_id: payload.lead_id || payload.contact_id,
      consultant_id: payload.consultant_id || 1,
      round_id: payload.round_id || 1,
      reason: payload.reason.trim(),
      note: payload.note || '',
      status: 'pending',
      created_at: new Date().toISOString(),
      deleted_at: null
    };

    this.dataReports.push(report);

    return {
      success: true,
      status: 200,
      message: 'Gửi báo cáo data lỗi thành công',
      report_id: report.id
    };
  }
}

export class WebTrackingCalendarSimulator {
  static generateStats(startDateStr, endDateStr, rawDailyEntries = []) {
    const rawMap = new Map();
    rawDailyEntries.forEach(e => {
      rawMap.set(e.date, {
        sessions: parseInt(e.sessions, 10) || 0,
        pageViews: parseInt(e.pageViews, 10) || 0
      });
    });

    const result = [];
    const curr = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (curr > end) {
      // Swapped date guard
      const temp = new Date(curr);
      curr.setTime(end.getTime());
      end.setTime(temp.getTime());
    }

    while (curr <= end) {
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;

      const existing = rawMap.get(dateKey) || { sessions: 0, pageViews: 0 };
      result.push({
        date: dateKey,
        sessions: Math.floor(Number(existing.sessions)),
        pageViews: Math.floor(Number(existing.pageViews))
      });

      curr.setDate(curr.getDate() + 1);
    }

    return result;
  }
}

export class IDORSimulator {
  static canAccessContact(auth, contact) {
    if (!contact || contact.deleted_at) return false;
    if (contact.tenant_id !== auth.tenant_id) return false;

    const privilegedRoles = ['admin', 'superadmin', 'super_admin', 'director', 'manager'];
    if (privilegedRoles.includes(String(auth.role).toLowerCase())) {
      return true;
    }

    // For sale users, must be owner or listed collaborator
    if (auth.role === 'sale') {
      const isOwner = Number(contact.owner_id) === Number(auth.user_id);
      const isCollaborator = Array.isArray(contact.collaborator_ids) && contact.collaborator_ids.includes(auth.user_id);
      return isOwner || isCollaborator;
    }

    return false;
  }

  static canAccessTicket(auth, ticket) {
    if (!ticket || ticket.deleted_at) return false;
    if (ticket.tenant_id !== auth.tenant_id) return false;

    const privilegedRoles = ['admin', 'superadmin', 'super_admin', 'director', 'supporter', 'manager'];
    if (privilegedRoles.includes(String(auth.role).toLowerCase())) {
      return true;
    }

    return Number(ticket.created_by) === Number(auth.user_id) || Number(ticket.assigned_to) === Number(auth.user_id);
  }
}

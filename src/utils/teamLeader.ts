import { getCachedTenantBootstrap, resolveDefaultWorkflowParticipants } from '../contexts/TenantConfigContext';

export const resolveTeamLeaderId = (
  currentUser: any,
  usersList: any[] = [],
  teamsList: any[] = []
): number | null => {
  if (!currentUser) return null;
  const currentUserId = Number(currentUser.id);
  const myUser = Array.isArray(usersList)
    ? (usersList.find((u: any) => Number(u.id) === currentUserId) || currentUser)
    : currentUser;

  const bootstrap = getCachedTenantBootstrap();
  const effectiveTeams = Array.isArray(teamsList) && teamsList.length > 0
    ? teamsList
    : (bootstrap?.teams || []);

  // 1. Assigned team's default_approver_id or leader_id
  const teamId = currentUser.team_id || myUser?.team_id;
  if (teamId && effectiveTeams.length > 0) {
    const myTeam = effectiveTeams.find((t: any) => Number(t.id) === Number(teamId));
    const directApprover = Number(myTeam?.default_approver_id || myTeam?.leader_id || 0);
    if (directApprover > 0 && directApprover !== currentUserId) {
      return directApprover;
    }
  }

  // 2. Match department_code in tenant teams
  const myDept = String(myUser?.department || currentUser?.department || '').toLowerCase();
  const myRole = String(myUser?.role || currentUser?.role || '').toLowerCase();

  let targetDeptCode = '';
  if (myDept.includes('sale') || myRole.includes('sale') || myDept.includes('tuyển sinh') || myDept.includes('kinh doanh')) {
    targetDeptCode = 'sales';
  } else if (myDept.includes('kế toán') || myRole.includes('accountant') || myRole.includes('ke_toan') || myDept.includes('tài chính')) {
    targetDeptCode = 'finance';
  } else if (myDept.includes('marketing') || myRole.includes('marketing') || myDept.includes('mkt')) {
    targetDeptCode = 'marketing';
  } else if (myDept.includes('nhân sự') || myDept.includes('hành chính') || myRole.includes('hr') || myRole.includes('human_resources')) {
    targetDeptCode = 'hr';
  } else if (myDept.includes('học vụ') || myDept.includes('học thuật') || myRole.includes('teacher') || myRole.includes('academic')) {
    targetDeptCode = 'academic';
  }

  if (targetDeptCode && effectiveTeams.length > 0) {
    const deptTeam = effectiveTeams.find((t: any) => {
      const dc = String(t.department_code || '').toLowerCase();
      if (dc === targetDeptCode) return true;
      const tName = String(t.name || '').toLowerCase();
      if (targetDeptCode === 'hr') return tName.includes('nhân sự') || tName.includes('hành chính');
      if (targetDeptCode === 'finance') return tName.includes('kế toán') || tName.includes('tài chính');
      if (targetDeptCode === 'marketing') return tName.includes('marketing');
      if (targetDeptCode === 'academic') return tName.includes('học vụ') || tName.includes('học thuật');
      return false;
    });
    const deptLeaderId = Number(deptTeam?.default_approver_id || deptTeam?.leader_id || 0);
    if (deptLeaderId > 0 && deptLeaderId !== currentUserId) {
      if (!Array.isArray(usersList) || usersList.length === 0 || usersList.some((u: any) => Number(u.id) === deptLeaderId)) {
        return deptLeaderId;
      }
    }
  }

  // 3. Tenant approval workflow configuration fallback
  const wfFallback = resolveDefaultWorkflowParticipants('leave', usersList, currentUserId);
  if (wfFallback.approverId && wfFallback.approverId !== currentUserId) {
    return wfFallback.approverId;
  }

  // 4. Tenant Executive fallback (Director -> Admin)
  if (Array.isArray(usersList)) {
    const director = usersList.find(
      (u: any) => ['director'].includes(String(u.role || '').toLowerCase()) && Number(u.id) !== currentUserId
    );
    if (director) return Number(director.id);

    const admin = usersList.find(
      (u: any) => ['admin', 'superadmin', 'super_admin'].includes(String(u.role || '').toLowerCase()) && Number(u.id) !== currentUserId
    );
    if (admin) return Number(admin.id);
  }

  return null;
};

export const resolveHrRepresentativeUser = (
  usersList: any[] = [],
  teamsList: any[] = []
): any | null => {
  if (!Array.isArray(usersList) || usersList.length === 0) return null;
  const bootstrap = getCachedTenantBootstrap();
  const effectiveTeams = Array.isArray(teamsList) && teamsList.length > 0
    ? teamsList
    : (bootstrap?.teams || []);

  // 1. Check HR team's default_approver_id or leader_id (excluding directors holding dual title)
  const hrTeam = effectiveTeams.find((t: any) => {
    const dc = String(t.department_code || '').toLowerCase();
    if (dc === 'hr') return true;
    const tName = String(t.name || '').toLowerCase();
    return tName.includes('nhân sự') || tName.includes('hành chính') || tName.includes('hcns') || tName.includes('human resources');
  });

  if (hrTeam) {
    const candidateIds = [Number(hrTeam.default_approver_id || 0), Number(hrTeam.leader_id || 0)].filter((n) => n > 0);
    for (const cid of candidateIds) {
      const u = usersList.find((item: any) => Number(item.id) === cid);
      if (u && !['director', 'superadmin', 'super_admin'].includes(String(u.role || '').toLowerCase())) {
        return u;
      }
    }
  }

  // 2. Explicit HR role user
  const hrRoleUser = usersList.find((u: any) => ['hr', 'nhan_su', 'human_resources'].includes(String(u.role || '').toLowerCase()));
  if (hrRoleUser) return hrRoleUser;

  // 3. Member of HR team
  if (hrTeam) {
    const hrMember = usersList.find(
      (u: any) => Number(u.team_id) === Number(hrTeam.id) && !['director', 'superadmin', 'super_admin'].includes(String(u.role || '').toLowerCase())
    );
    if (hrMember) return hrMember;
  }

  return null;
};

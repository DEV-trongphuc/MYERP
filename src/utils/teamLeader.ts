/**
 * Utility to resolve the default Level 1 Approver (Team Leader)
 * according to company organizational hierarchy.
 */

export const resolveTeamLeaderId = (
  currentUser: any,
  usersList: any[] = [],
  teamsList: any[] = []
): number | null => {
  if (!currentUser) return null;
  const currentUserId = Number(currentUser.id);
  const myUser = usersList.find((u: any) => Number(u.id) === currentUserId) || currentUser;

  // 1. Check user's assigned team in DB
  const teamId = currentUser.team_id || myUser?.team_id;
  if (teamId && Array.isArray(teamsList)) {
    const myTeam = teamsList.find((t: any) => Number(t.id) === Number(teamId));
    if (myTeam && myTeam.leader_id && Number(myTeam.leader_id) !== currentUserId) {
      return Number(myTeam.leader_id);
    }
  }

  // 2. Fallback by department or role keywords
  const myDept = (myUser?.department || currentUser?.department || '').toLowerCase();
  const myRole = (myUser?.role || currentUser?.role || '').toLowerCase();

  let targetLeaderId: number | null = null;
  const myEmail = (myUser?.email || currentUser?.email || '').toLowerCase();

  if (
    myDept.includes('sale') ||
    myRole.includes('sale') ||
    myDept.includes('tuyển sinh') ||
    myDept.includes('kinh doanh')
  ) {
    targetLeaderId = 100062; // Mai Thị Nữ (Leader Sales / Director)
  } else if (
    myDept.includes('kế toán') ||
    myRole.includes('accountant') ||
    myRole.includes('ke_toan') ||
    myDept.includes('tài chính')
  ) {
    targetLeaderId = 100064; // Nguyễn Thu Thảo (Leader Kế toán)
  } else if (
    myDept.includes('marketing') ||
    myRole.includes('marketing') ||
    myDept.includes('mkt')
  ) {
    targetLeaderId = 100069; // Trịnh Đình Thanh (Leader Marketing)
  } else if (
    myEmail === 'cuongnph@ideas.edu.vn' ||
    myDept.includes('nhân sự') ||
    myDept.includes('hành chính') ||
    myRole.includes('hr') ||
    myRole.includes('human_resources')
  ) {
    const phuongUser = usersList.find((u: any) =>
      u.username === 'phuongntd' ||
      u.email?.startsWith('phuongntd') ||
      String(u.full_name || '').toLowerCase().includes('duy phương') ||
      Number(u.id) === 100065
    );
    targetLeaderId = phuongUser ? Number(phuongUser.id) : 100065; // Nguyễn Thị Duy Phương (Leader HC-NS)
  } else if (
    myEmail === 'nganph@ideas.edu.vn' ||
    myDept.includes('học vụ') ||
    myDept.includes('học thuật') ||
    myRole.includes('teacher') ||
    myRole.includes('academic')
  ) {
    const tramUser = usersList.find((u: any) =>
      u.email === 'tramlth@ideas.edu.vn' ||
      u.username === 'tramlth' ||
      String(u.full_name || '').toLowerCase().includes('huyền trâm') ||
      Number(u.id) === 100073
    );
    targetLeaderId = tramUser ? Number(tramUser.id) : 100073; // Lê Thị Huyền Trâm (Leader Học vụ - học thuật)
  }

  // If target leader found and user is not that leader, verify in users list
  if (targetLeaderId && targetLeaderId !== currentUserId) {
    const leaderUser = usersList.find((u: any) => Number(u.id) === targetLeaderId);
    if (leaderUser) return targetLeaderId;
  }

  // 3. Proposer is the team leader or no specific department -> Fallback to Director / Admin
  const director = usersList.find(
    (u: any) =>
      ['director'].includes(String(u.role).toLowerCase()) &&
      Number(u.id) !== currentUserId
  );
  if (director) return Number(director.id);

  const admin = usersList.find(
    (u: any) =>
      ['admin', 'superadmin', 'super_admin'].includes(String(u.role).toLowerCase()) &&
      Number(u.id) !== currentUserId
  );
  if (admin) return Number(admin.id);

  return null;
};

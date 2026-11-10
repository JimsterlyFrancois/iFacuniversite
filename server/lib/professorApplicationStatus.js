export function deriveProfessorRoleStatus(approvedCount, pendingCount) {
  if (Number(approvedCount) > 0) return "active";
  if (Number(pendingCount) > 0) return "pending";
  return "revoked";
}

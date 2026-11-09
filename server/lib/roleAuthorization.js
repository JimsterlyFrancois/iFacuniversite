function rolesFor(req) {
  if (Array.isArray(req?.activeRoles)) return req.activeRoles;
  if (Array.isArray(req?.roleAssignments)) return req.roleAssignments.filter(a => a?.status === "active").map(a => a.role);
  return null;
}
export function hasActiveRole(req, role) {
  const roles = rolesFor(req);
  return roles ? roles.includes(role) : req?.user?.role === role;
}
export function isGeneralAdmin(req) {
  return req?.user?.role === "admin" || hasActiveRole(req, "admin_general");
}
export function requireGeneralAdmin(req, res, next) {
  if (!isGeneralAdmin(req)) return res.status(403).json({ error: "administrator_required" });
  req.isAdminGeneral = true;
  return next();
}

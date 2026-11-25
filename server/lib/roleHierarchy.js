const APPROVER_ROLE = {
  faculty_manager: "university_admin",
  program_manager: "faculty_manager",
  professor: "program_manager"
};

export async function hasActiveRoleApprover(queryable, scope) {
  const approverRole = APPROVER_ROLE[scope?.role];
  if (!approverRole) return true;

  let sql;
  let params;
  if (scope.role === "faculty_manager") {
    sql = `SELECT 1
      FROM role_assignments ra
      JOIN users approver ON approver.id=ra.user_id AND approver.is_active=TRUE
      JOIN universities u ON u.id=ra.university_id AND u.is_active=TRUE
      WHERE ra.role=$1 AND ra.status='active' AND ra.university_id=$2
      LIMIT 1`;
    params = [approverRole, scope.universityId];
  } else if (scope.role === "program_manager") {
    sql = `SELECT 1
      FROM role_assignments ra
      JOIN users approver ON approver.id=ra.user_id AND approver.is_active=TRUE
      JOIN universities u ON u.id=ra.university_id AND u.is_active=TRUE
      JOIN faculties f ON f.id=ra.faculty_id AND f.university_id=u.id AND f.is_active=TRUE
      WHERE ra.role=$1 AND ra.status='active'
        AND ra.university_id=$2 AND ra.faculty_id=$3
      LIMIT 1`;
    params = [approverRole, scope.universityId, scope.facultyId];
  } else {
    sql = `SELECT 1
      FROM role_assignments ra
      JOIN users approver ON approver.id=ra.user_id AND approver.is_active=TRUE
      JOIN universities u ON u.id=ra.university_id AND u.is_active=TRUE
      JOIN faculties f ON f.id=ra.faculty_id AND f.university_id=u.id AND f.is_active=TRUE
      JOIN options o ON o.id=ra.option_id AND o.faculty_id=f.id AND o.is_active=TRUE
      LEFT JOIN study_levels l ON l.id=ra.study_level_id AND l.option_id=o.id
      WHERE ra.role=$1 AND ra.status='active'
        AND ra.university_id=$2 AND ra.faculty_id=$3 AND ra.option_id=$4
        AND (ra.study_level_id IS NULL OR (l.id IS NOT NULL AND l.is_active=TRUE))
        AND ($5::bigint IS NULL OR ra.study_level_id IS NULL OR ra.study_level_id=$5)
      LIMIT 1`;
    params = [approverRole, scope.universityId, scope.facultyId, scope.optionId, scope.studyLevelId || null];
  }

  const result = await queryable.query(sql, params);
  return result.rowCount > 0;
}

export function roleApproverMessage(role) {
  if (role === "faculty_manager") return "Aucun responsable d’université actif ne peut encore valider cette demande. Demandez d’abord la nomination d’un responsable d’université.";
  if (role === "program_manager") return "Aucun responsable de faculté actif ne peut encore valider cette demande pour cette faculté.";
  if (role === "professor") return "Aucun responsable de programme actif ne peut encore examiner cette demande de cours.";
  return "";
}

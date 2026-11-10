export async function listRegistrableUniversities(queryable) {
  return queryable.query(
    "SELECT id, code, name FROM universities WHERE is_active = TRUE ORDER BY name"
  );
}

export async function findActiveAcademicProfile(queryable, {
  universityCode, facultyCode, optionCode, studyLevelCode
}) {
  return queryable.query(
    `SELECT u.id AS university_id, f.id AS faculty_id, o.id AS option_id, l.id AS study_level_id
     FROM universities u
     JOIN faculties f ON f.university_id=u.id
     JOIN options o ON o.faculty_id=f.id
     JOIN study_levels l ON l.option_id=o.id
     WHERE u.code=$1 AND f.code=$2 AND o.code=$3 AND l.code=$4
       AND u.is_active=TRUE AND f.is_active=TRUE AND o.is_active=TRUE AND l.is_active=TRUE`,
    [universityCode, facultyCode, optionCode, studyLevelCode]
  );
}

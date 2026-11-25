export async function listRegistrableUniversities(queryable) {
  return queryable.query(
    `SELECT u.id, u.code, u.name
     FROM universities u
     WHERE u.is_active = TRUE
       AND u.registration_enabled = TRUE
       AND EXISTS (
         SELECT 1
         FROM faculties f
         JOIN options o ON o.faculty_id=f.id
         JOIN study_levels l ON l.option_id=o.id
         WHERE f.university_id=u.id
           AND f.is_active=TRUE AND o.is_active=TRUE AND l.is_active=TRUE
       )
     ORDER BY u.name`
  );
}

// Administrative role applications must still be able to select an active
// university while student registration is closed and its catalogue is being built.
export async function listActiveRoleUniversities(queryable) {
  return queryable.query(
    "SELECT id, code, name FROM universities WHERE is_active = TRUE ORDER BY name"
  );
}

export async function listProfessorUniversities(queryable) {
  return queryable.query(
    `SELECT DISTINCT u.id, u.code, u.name
     FROM universities u
     JOIN faculties f ON f.university_id=u.id
     JOIN options o ON o.faculty_id=f.id
     JOIN study_levels l ON l.option_id=o.id
     JOIN subjects s ON s.option_id=o.id AND s.study_level_id=l.id
     JOIN courses course ON course.subject_id=s.id
     WHERE u.is_active=TRUE AND f.is_active=TRUE AND o.is_active=TRUE
       AND l.is_active=TRUE AND s.is_active=TRUE AND course.is_active=TRUE
     ORDER BY u.name`
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
       AND u.is_active=TRUE AND u.registration_enabled=TRUE
       AND f.is_active=TRUE AND o.is_active=TRUE AND l.is_active=TRUE`,
    [universityCode, facultyCode, optionCode, studyLevelCode]
  );
}

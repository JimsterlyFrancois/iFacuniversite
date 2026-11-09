import express from "express";

const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function createProgramManagerRouter({ pool, requireAuth }) {
  const router = express.Router();

  async function requireProgramManager(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT ra.university_id,ra.faculty_id,ra.option_id,ra.study_level_id,
                u.name AS university_name,f.name AS faculty_name,o.name AS option_name
         FROM role_assignments ra
         JOIN universities u ON u.id=ra.university_id
         JOIN faculties f ON f.id=ra.faculty_id
         JOIN options o ON o.id=ra.option_id
         WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
           AND u.is_active=TRUE AND f.is_active=TRUE AND o.is_active=TRUE
         ORDER BY u.name,f.name,o.name`,
        [req.user.id]
      );
      if (!result.rowCount) return res.status(403).json({ error: "program_manager_required", message: "Votre compte ne possède pas de nomination active comme responsable de programme." });
      req.programScopes = result.rows;
      next();
    } catch {
      return res.status(503).json({ error: "program_scope_unavailable" });
    }
  }

  const inScope = (alias = "s") => `EXISTS (
    SELECT 1 FROM role_assignments scope
    WHERE scope.user_id=$1 AND scope.role='program_manager' AND scope.status='active'
      AND scope.university_id=$2 AND scope.faculty_id=$3 AND scope.option_id=${alias}.option_id
      AND (scope.study_level_id IS NULL OR scope.study_level_id=${alias}.study_level_id)
  )`;

  router.get("/program-manager/overview", requireAuth, requireProgramManager, async (req, res) => {
    try {
      const [students, courses, professors, documents] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM users u
          WHERE u.is_active=TRUE AND u.role IN ('student','delegate') AND EXISTS (
            SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
              AND ra.university_id=u.university_id AND ra.faculty_id=u.faculty_id AND ra.option_id=u.option_id
              AND (ra.study_level_id IS NULL OR ra.study_level_id=u.study_level_id)
          )`, [req.user.id]),
        pool.query(`SELECT COUNT(*)::int AS total FROM courses c JOIN subjects s ON s.id=c.subject_id
          WHERE c.is_active=TRUE AND ${inScope("s")}`, [req.user.id, req.programScopes[0].university_id, req.programScopes[0].faculty_id]),
        pool.query(`SELECT COUNT(DISTINCT i.id)::int AS total FROM professor_invites i
          JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE
          WHERE EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=pa.university_id AND ra.faculty_id=pa.faculty_id AND ra.option_id=pa.option_id
            AND (ra.study_level_id IS NULL OR ra.study_level_id=pa.study_level_id))`, [req.user.id]),
        pool.query(`SELECT COUNT(*)::int AS total FROM documents d
          WHERE d.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=d.university_id AND ra.faculty_id=d.faculty_id AND ra.option_id=d.option_id
            AND (ra.study_level_id IS NULL OR ra.study_level_id=d.study_level_id))`, [req.user.id])
      ]);
      return res.json({
        data: {
          students: students.rows[0].total,
          courses: courses.rows[0].total,
          professors: professors.rows[0].total,
          documents: documents.rows[0].total
        },
        scopes: req.programScopes
      });
    } catch {
      return res.status(503).json({ error: "program_overview_unavailable" });
    }
  });

  router.get("/program-manager/catalog", requireAuth, requireProgramManager, async (req, res) => {
    try {
      const [subjects, courses] = await Promise.all([
        pool.query(`SELECT s.id,s.name,s.option_id,s.study_level_id,l.label AS level_label,o.name AS option_name
          FROM subjects s JOIN options o ON o.id=s.option_id JOIN study_levels l ON l.id=s.study_level_id
          WHERE s.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
              AND ra.university_id=(SELECT university_id FROM role_assignments WHERE user_id=$1 AND role='program_manager' AND status='active' ORDER BY id LIMIT 1)
              AND ra.faculty_id=(SELECT faculty_id FROM role_assignments WHERE user_id=$1 AND role='program_manager' AND status='active' ORDER BY id LIMIT 1)
              AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))
          ORDER BY o.name,l.sort_order,s.name`, [req.user.id]),
        pool.query(`SELECT c.id,c.name,c.description,s.id AS subject_id,s.name AS subject_name,
            s.option_id,s.study_level_id,o.name AS option_name,l.label AS level_label
          FROM courses c JOIN subjects s ON s.id=c.subject_id JOIN options o ON o.id=s.option_id
          JOIN study_levels l ON l.id=s.study_level_id
          WHERE c.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
              AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))
          ORDER BY o.name,l.sort_order,s.name,c.name`, [req.user.id])
      ]);
      return res.json({ data: { subjects: subjects.rows, courses: courses.rows, scopes: req.programScopes } });
    } catch {
      return res.status(503).json({ error: "program_catalog_unavailable" });
    }
  });

  router.post("/program-manager/courses", requireAuth, requireProgramManager, async (req, res) => {
    const subjectId = positiveId(req.body?.subjectId);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!subjectId || !name || name.length > 180 || description.length > 3000)
      return res.status(400).json({ error: "invalid_course", message: "Choisissez une matière et indiquez le nom du cours." });
    try {
      const subject = await pool.query(`SELECT s.id FROM subjects s WHERE s.id=$1 AND s.is_active=TRUE
        AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$2 AND ra.role='program_manager'
          AND ra.status='active' AND ra.option_id=s.option_id
          AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))`, [subjectId, req.user.id]);
      if (!subject.rowCount) return res.status(403).json({ error: "subject_outside_program_scope" });
      const created = await pool.query(
        "INSERT INTO courses(subject_id,name,description,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,description,subject_id",
        [subjectId, name, description || null, req.user.id]
      );
      return res.status(201).json({ course: created.rows[0], message: "Cours créé dans votre programme." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "course_already_exists", message: "Ce cours existe déjà pour cette matière." });
      return res.status(503).json({ error: "course_create_failed" });
    }
  });

  router.get("/program-manager/professors", requireAuth, requireProgramManager, async (req, res) => {
    try {
      const result = await pool.query(`SELECT i.id,i.email,i.first_name,i.last_name,i.activated_at,i.is_active,
          COALESCE(json_agg(json_build_object('assignment_id',pa.id,'course_id',c.id,'course_name',c.name,
            'option_name',o.name,'level_label',l.label,'active',pa.is_active)) FILTER (WHERE pa.id IS NOT NULL),'[]') AS assignments
        FROM professor_invites i
        JOIN professor_assignments pa ON pa.invite_id=i.id
        JOIN courses c ON c.id=pa.course_id
        JOIN subjects s ON s.id=c.subject_id
        JOIN options o ON o.id=pa.option_id
        JOIN study_levels l ON l.id=pa.study_level_id
        WHERE EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager'
          AND ra.status='active' AND ra.university_id=pa.university_id AND ra.faculty_id=pa.faculty_id
          AND ra.option_id=pa.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=pa.study_level_id))
        GROUP BY i.id ORDER BY i.created_at DESC LIMIT 300`, [req.user.id]);
      return res.json({ data: result.rows });
    } catch {
      return res.status(503).json({ error: "program_professors_unavailable" });
    }
  });

  router.post("/program-manager/professors", requireAuth, requireProgramManager, async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const courseId = positiveId(req.body?.courseId);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !firstName || firstName.length > 100 || !lastName || lastName.length > 100 || !courseId)
      return res.status(400).json({ error: "invalid_professor", message: "Renseignez le nom, le prénom, l’e-mail et le cours." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const course = await client.query(`SELECT c.id,s.option_id,s.study_level_id,f.id AS faculty_id,f.university_id
        FROM courses c JOIN subjects s ON s.id=c.subject_id JOIN options o ON o.id=s.option_id
        JOIN faculties f ON f.id=o.faculty_id
        WHERE c.id=$1 AND c.is_active=TRUE AND s.is_active=TRUE
          AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$2 AND ra.role='program_manager'
            AND ra.status='active' AND ra.university_id=f.university_id AND ra.faculty_id=f.id
            AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))
        FOR SHARE OF c`, [courseId, req.user.id]);
      if (!course.rowCount) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "course_outside_program_scope", message: "Ce cours ne relève pas de votre programme." });
      }
      const existingUser = await client.query("SELECT id FROM users WHERE email=$1", [email]);
      if (existingUser.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "email_already_used", message: "Cette adresse possède déjà un compte iFac. Demandez à l’administration de vérifier son affectation." });
      }
      let invite = await client.query("SELECT id,is_active FROM professor_invites WHERE email=$1 FOR UPDATE", [email]);
      if (invite.rowCount && !invite.rows[0].is_active) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "professor_invite_inactive" });
      }
      let inviteId;
      if (invite.rowCount) inviteId = invite.rows[0].id;
      else {
        const created = await client.query(
          "INSERT INTO professor_invites(email,first_name,last_name,created_by) VALUES($1,$2,$3,$4) RETURNING id",
          [email, firstName, lastName, req.user.id]
        );
        inviteId = created.rows[0].id;
      }
      await client.query(
        "INSERT INTO professor_assignments(invite_id,university_id,faculty_id,option_id,study_level_id,course_id,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [inviteId, course.rows[0].university_id, course.rows[0].faculty_id, course.rows[0].option_id, course.rows[0].study_level_id, courseId, req.user.id]
      );
      await client.query("COMMIT");
      return res.status(201).json({ message: invite.rowCount ? "Cours ajouté au professeur déjà déclaré." : "Professeur déclaré. Il peut activer son compte après confirmation de son e-mail." });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") return res.status(409).json({ error: "assignment_exists", message: "Ce professeur possède déjà cette affectation." });
      return res.status(503).json({ error: "professor_assignment_failed" });
    } finally {
      client.release();
    }
  });

  router.get("/program-manager/documents", requireAuth, requireProgramManager, async (req, res) => {
    try {
      const result = await pool.query(`SELECT d.id,d.title,d.course,d.professor,d.description,d.file_name,d.status,d.created_at,
          f.name AS faculty_name,o.name AS option_name,l.label AS level_label
        FROM documents d LEFT JOIN faculties f ON f.id=d.faculty_id
        LEFT JOIN options o ON o.id=d.option_id LEFT JOIN study_levels l ON l.id=d.study_level_id
        WHERE d.is_active=TRUE AND d.storage_bucket='class-documents'
          AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager'
            AND ra.status='active' AND ra.university_id=d.university_id AND ra.faculty_id=d.faculty_id
            AND ra.option_id=d.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=d.study_level_id))
        ORDER BY d.created_at DESC LIMIT 300`, [req.user.id]);
      return res.json({ data: result.rows });
    } catch {
      return res.status(503).json({ error: "program_documents_unavailable" });
    }
  });

  return router;
}

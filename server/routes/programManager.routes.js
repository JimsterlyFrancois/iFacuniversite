import express from "express";

const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function createProgramManagerRouter({ pool, requireAuth, readPrivateObject }) {
  const router = express.Router();

  async function requireProgramManager(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT ra.university_id,ra.faculty_id,ra.option_id,ra.study_level_id,
                u.name AS university_name,f.name AS faculty_name,o.name AS option_name,
                l.label AS study_level_label
         FROM role_assignments ra
         JOIN universities u ON u.id=ra.university_id
         JOIN faculties f ON f.id=ra.faculty_id AND f.university_id=u.id
         JOIN options o ON o.id=ra.option_id AND o.faculty_id=f.id
         LEFT JOIN study_levels l ON l.id=ra.study_level_id AND l.option_id=o.id
         WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
           AND u.is_active=TRUE AND f.is_active=TRUE AND o.is_active=TRUE
           AND (ra.study_level_id IS NULL OR l.id IS NOT NULL)
         ORDER BY u.name,f.name,o.name,l.sort_order`,
        [req.user.id]
      );
      if (!result.rowCount) return res.status(403).json({ error: "program_manager_required", message: "Votre compte ne possède pas de nomination active comme responsable de programme." });
      req.programScopes = result.rows;
      next();
    } catch {
      return res.status(503).json({ error: "program_scope_unavailable" });
    }
  }

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
          WHERE c.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            JOIN options o ON o.id=ra.option_id JOIN faculties f ON f.id=o.faculty_id
            WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
              AND ra.university_id=f.university_id AND ra.faculty_id=f.id
              AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))`, [req.user.id]),
        pool.query(`SELECT COUNT(DISTINCT i.id)::int AS total FROM professor_invites i
          JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE
          WHERE EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=pa.university_id AND ra.faculty_id=pa.faculty_id AND ra.option_id=pa.option_id
            AND (ra.study_level_id IS NULL OR ra.study_level_id=pa.study_level_id))`, [req.user.id]),
        pool.query(`SELECT COUNT(*)::int AS total FROM documents d
          WHERE d.is_active=TRUE AND d.storage_bucket='class-documents'
            AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
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
      const [subjects, courses, levels] = await Promise.all([
        pool.query(`SELECT s.id,s.name,s.option_id,s.study_level_id,l.label AS level_label,o.name AS option_name
          FROM subjects s JOIN options o ON o.id=s.option_id JOIN study_levels l ON l.id=s.study_level_id
          WHERE s.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            JOIN options scope_option ON scope_option.id=ra.option_id
            JOIN faculties scope_faculty ON scope_faculty.id=scope_option.faculty_id
            WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
              AND ra.university_id=scope_faculty.university_id AND ra.faculty_id=scope_faculty.id
              AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))
          ORDER BY o.name,l.sort_order,s.name`, [req.user.id]),
        pool.query(`SELECT c.id,c.name,c.description,s.id AS subject_id,s.name AS subject_name,
            s.option_id,s.study_level_id,o.name AS option_name,l.label AS level_label
          FROM courses c JOIN subjects s ON s.id=c.subject_id JOIN options o ON o.id=s.option_id
          JOIN study_levels l ON l.id=s.study_level_id
          WHERE c.is_active=TRUE AND EXISTS (SELECT 1 FROM role_assignments ra
            JOIN options scope_option ON scope_option.id=ra.option_id
            JOIN faculties scope_faculty ON scope_faculty.id=scope_option.faculty_id
            WHERE ra.user_id=$1 AND ra.role='program_manager' AND ra.status='active'
              AND ra.university_id=scope_faculty.university_id AND ra.faculty_id=scope_faculty.id
              AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))
          ORDER BY o.name,l.sort_order,s.name,c.name`, [req.user.id]),
        pool.query(`SELECT o.id AS option_id,o.name AS option_name,l.id AS study_level_id,l.label AS level_label
          FROM options o JOIN faculties f ON f.id=o.faculty_id
          JOIN study_levels l ON l.option_id=o.id
          WHERE o.is_active=TRUE AND f.is_active=TRUE AND l.is_active=TRUE
            AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$1
              AND ra.role='program_manager' AND ra.status='active'
              AND ra.university_id=f.university_id AND ra.faculty_id=f.id
              AND ra.option_id=o.id AND (ra.study_level_id IS NULL OR ra.study_level_id=l.id))
          ORDER BY o.name,l.sort_order`, [req.user.id])
      ]);
      return res.json({ data: { subjects: subjects.rows, courses: courses.rows, levels: levels.rows, scopes: req.programScopes } });
    } catch {
      return res.status(503).json({ error: "program_catalog_unavailable" });
    }
  });

  router.post("/program-manager/subjects", requireAuth, requireProgramManager, async (req, res) => {
    const optionId = positiveId(req.body?.optionId);
    const studyLevelId = positiveId(req.body?.studyLevelId);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!optionId || !studyLevelId || !name || name.length > 180) {
      return res.status(400).json({ error: "invalid_subject", message: "Choisissez une option, un niveau et indiquez le nom de la matière." });
    }
    try {
      const scope = await pool.query(`SELECT o.id,o.faculty_id,f.university_id,l.id AS study_level_id
        FROM options o JOIN faculties f ON f.id=o.faculty_id
        JOIN study_levels l ON l.option_id=o.id
        WHERE o.id=$1 AND l.id=$2 AND o.is_active=TRUE AND f.is_active=TRUE AND l.is_active=TRUE
          AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$3
            AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=f.university_id AND ra.faculty_id=f.id
            AND ra.option_id=o.id AND (ra.study_level_id IS NULL OR ra.study_level_id=l.id))`,
        [optionId, studyLevelId, req.user.id]);
      if (!scope.rowCount) return res.status(403).json({ error: "subject_outside_program_scope" });
      const created = await pool.query(
        "INSERT INTO subjects(option_id,study_level_id,name,is_active) VALUES($1,$2,$3,TRUE) RETURNING id,name,option_id,study_level_id",
        [optionId, studyLevelId, name]
      );
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata) VALUES($1,'program.subject_created','subject',$2,$3,$4,$5,$6,$7::jsonb)",
        [req.user.id, created.rows[0].id, scope.rows[0].university_id, scope.rows[0].faculty_id, optionId, studyLevelId, JSON.stringify({ name })]
      );
      return res.status(201).json({ subject: created.rows[0], message: "Matière créée dans votre programme." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "subject_already_exists", message: "Cette matière existe déjà pour ce niveau." });
      return res.status(503).json({ error: "subject_create_failed" });
    }
  });

  router.patch("/program-manager/subjects/:id", requireAuth, requireProgramManager, async (req, res) => {
    const id = positiveId(req.params.id);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const active = req.body?.isActive;
    if (!id || !name || name.length > 180 || typeof active !== "boolean") return res.status(400).json({ error: "invalid_subject_update" });
    try {
      const result = await pool.query(`UPDATE subjects s SET name=$1,is_active=$2
        WHERE s.id=$3 AND EXISTS (SELECT 1 FROM options o JOIN faculties f ON f.id=o.faculty_id
          JOIN role_assignments ra ON ra.user_id=$4 AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=f.university_id AND ra.faculty_id=f.id AND ra.option_id=o.id
            AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id)
          WHERE o.id=s.option_id)
        RETURNING s.id,s.name,s.option_id,s.study_level_id,s.is_active`,
        [name, active, id, req.user.id]);
      if (!result.rowCount) return res.status(404).json({ error: "subject_not_found" });
      return res.json({ subject: result.rows[0], message: "Matière mise à jour." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "subject_already_exists" });
      return res.status(503).json({ error: "subject_update_failed" });
    }
  });

  router.delete("/program-manager/subjects/:id", requireAuth, requireProgramManager, async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_subject_id" });
    try {
      const result = await pool.query(`UPDATE subjects s SET is_active=FALSE
        WHERE s.id=$1 AND EXISTS (SELECT 1 FROM options o JOIN faculties f ON f.id=o.faculty_id
          JOIN role_assignments ra ON ra.user_id=$2 AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=f.university_id AND ra.faculty_id=f.id AND ra.option_id=o.id
            AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id)
          WHERE o.id=s.option_id)
        RETURNING s.id`, [id, req.user.id]);
      if (!result.rowCount) return res.status(404).json({ error: "subject_not_found" });
      return res.json({ message: "Matière désactivée. Les cours et documents historiques sont conservés." });
    } catch { return res.status(503).json({ error: "subject_deactivate_failed" }); }
  });

  router.post("/program-manager/courses", requireAuth, requireProgramManager, async (req, res) => {
    const subjectId = positiveId(req.body?.subjectId);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!subjectId || !name || name.length > 180 || description.length > 3000)
      return res.status(400).json({ error: "invalid_course", message: "Choisissez une matière et indiquez le nom du cours." });
    try {
      const subject = await pool.query(`SELECT s.id,s.option_id,s.study_level_id FROM subjects s
        JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id
        WHERE s.id=$1 AND s.is_active=TRUE AND o.is_active=TRUE AND f.is_active=TRUE
          AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$2 AND ra.role='program_manager'
            AND ra.status='active' AND ra.university_id=f.university_id AND ra.faculty_id=f.id
            AND ra.option_id=s.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=s.study_level_id))`, [subjectId, req.user.id]);
      if (!subject.rowCount) return res.status(403).json({ error: "subject_outside_program_scope" });
      const created = await pool.query(
        "INSERT INTO courses(subject_id,name,description,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,description,subject_id",
        [subjectId, name, description || null, req.user.id]
      );
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,option_id,study_level_id,metadata) VALUES($1,'program.course_created','course',$2,$3,$4,$5::jsonb)",
        [req.user.id,created.rows[0].id,subject.rows[0].option_id,subject.rows[0].study_level_id,JSON.stringify({ subjectId })]
      );
      return res.status(201).json({ course: created.rows[0], message: "Cours créé dans votre programme." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "course_already_exists", message: "Ce cours existe déjà pour cette matière." });
      return res.status(503).json({ error: "course_create_failed" });
    }
  });

  router.get("/program-manager/professors", requireAuth, requireProgramManager, async (req, res) => {
    try {
      const result = await pool.query(`SELECT i.id,i.user_id,i.email,i.first_name,i.last_name,i.activated_at,i.is_active,
          COALESCE(MAX(ra.status)::text,CASE WHEN i.user_id IS NULL THEN 'invited' ELSE 'pending' END) AS role_status,
          COALESCE(json_agg(json_build_object('assignment_id',pa.id,'course_id',pa.course_id,'course_name',c.name,
            'option_id',pa.option_id,'study_level_id',pa.study_level_id,
            'option_name',o.name,'level_label',l.label,'active',pa.is_active)) FILTER (WHERE pa.id IS NOT NULL),'[]') AS assignments
        FROM professor_invites i
        JOIN professor_assignments pa ON pa.invite_id=i.id
        LEFT JOIN courses c ON c.id=pa.course_id
        JOIN options o ON o.id=pa.option_id
        JOIN study_levels l ON l.id=pa.study_level_id
        LEFT JOIN role_assignments ra ON ra.user_id=i.user_id AND ra.role='professor'
        WHERE pa.is_active=TRUE AND EXISTS (
          SELECT 1 FROM role_assignments pm WHERE pm.user_id=$1 AND pm.role='program_manager'
            AND pm.status='active' AND pm.university_id=pa.university_id AND pm.faculty_id=pa.faculty_id
            AND pm.option_id=pa.option_id AND (pm.study_level_id IS NULL OR pm.study_level_id=pa.study_level_id)
        )
        GROUP BY i.id ORDER BY i.created_at DESC LIMIT 300`, [req.user.id]);
      return res.json({ data: result.rows });
    } catch {
      return res.status(503).json({ error: "program_professors_unavailable" });
    }
  });

  router.patch("/program-manager/professors/:id/decision", requireAuth, requireProgramManager, async (req, res) => {
    const inviteId = positiveId(req.params.id);
    const decision = req.body?.decision;
    const courseId = positiveId(req.body?.courseId);
    if (!inviteId || !["approve","reject"].includes(decision)) {
      return res.status(400).json({ error: "invalid_professor_decision" });
    }
    if (decision === "approve" && !courseId) {
      return res.status(400).json({
        error: "course_required",
        message: "Choisissez un cours du programme pour confirmer l’affectation pédagogique."
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const application = await client.query(\`
        SELECT i.id,i.user_id,pa.id AS assignment_id,pa.university_id,pa.faculty_id,pa.option_id,pa.study_level_id
        FROM professor_invites i
        JOIN professor_assignments pa ON pa.invite_id=i.id AND pa.is_active=TRUE
        JOIN role_assignments ra ON ra.user_id=i.user_id AND ra.role='professor' AND ra.status='pending'
        WHERE i.id=$1 AND i.user_id IS NOT NULL AND i.is_active=TRUE
          AND EXISTS (
            SELECT 1 FROM role_assignments pm WHERE pm.user_id=$2 AND pm.role='program_manager'
              AND pm.status='active' AND pm.university_id=pa.university_id
              AND pm.faculty_id=pa.faculty_id AND pm.option_id=pa.option_id
              AND (pm.study_level_id IS NULL OR pm.study_level_id=pa.study_level_id)
          )
        ORDER BY pa.created_at DESC,pa.id DESC
        LIMIT 1 FOR UPDATE OF i,pa,ra
      \`, [inviteId,req.user.id]);

      if (!application.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "professor_application_not_found",
          message: "Cette demande n’existe pas ou ne relève pas de votre programme."
        });
      }
      const item = application.rows[0];

      if (decision === "reject") {
        await client.query("UPDATE professor_assignments SET is_active=FALSE WHERE id=$1", [item.assignment_id]);
        await client.query(
          \`UPDATE role_assignments SET status='revoked',approved_by=$1,revoked_at=NOW(),updated_at=NOW()
           WHERE user_id=$2 AND role='professor' AND status='pending'\`,
          [req.user.id,item.user_id]
        );
        await client.query(
          \`INSERT INTO admin_audit_logs(
             actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata
           ) VALUES($1,'professor.application.rejected','professor_invite',$2,$3,$4,$5,$6,$7::jsonb)\`,
          [req.user.id,inviteId,item.university_id,item.faculty_id,item.option_id,item.study_level_id,JSON.stringify({userId:item.user_id})]
        );
        await client.query("COMMIT");
        return res.json({ message: "Demande de professeur refusée." });
      }

      const course = await client.query(\`
        SELECT c.id FROM courses c JOIN subjects s ON s.id=c.subject_id
        JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id
        WHERE c.id=$1 AND c.is_active=TRUE AND s.is_active=TRUE
          AND f.is_active=TRUE AND o.is_active=TRUE
          AND f.university_id=$2 AND f.id=$3 AND s.option_id=$4 AND s.study_level_id=$5
      \`, [courseId,item.university_id,item.faculty_id,item.option_id,item.study_level_id]);

      if (!course.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "course_outside_application_scope",
          message: "Le cours choisi ne correspond pas à la demande du professeur."
        });
      }

      await client.query(
        "UPDATE professor_assignments SET course_id=$1,assigned_by=$2,is_active=TRUE WHERE id=$3",
        [courseId,req.user.id,item.assignment_id]
      );
      const activated = await client.query(
        \`UPDATE role_assignments SET status='active',assigned_by=COALESCE(assigned_by,$1),
           approved_by=$1,revoked_at=NULL,updated_at=NOW()
         WHERE user_id=$2 AND role='professor' AND status='pending' RETURNING id\`,
        [req.user.id,item.user_id]
      );
      if (!activated.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "professor_application_already_processed" });
      }
      await client.query(
        \`INSERT INTO admin_audit_logs(
           actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata
         ) VALUES($1,'professor.application.approved','professor_invite',$2,$3,$4,$5,$6,$7::jsonb)\`,
        [req.user.id,inviteId,item.university_id,item.faculty_id,item.option_id,item.study_level_id,JSON.stringify({userId:item.user_id,courseId})]
      );
      await client.query("COMMIT");
      return res.json({ message: "Demande validée. Le professeur peut maintenant accéder à son espace." });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Décision demande professeur:",error?.message || error);
      return res.status(503).json({ error: "professor_application_decision_failed" });
    } finally {
      client.release();
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
      let invite = await client.query("SELECT id,is_active,user_id,first_name,last_name FROM professor_invites WHERE email=$1 FOR UPDATE", [email]);
      const existingUser = await client.query("SELECT id,role,is_active FROM users WHERE email=$1", [email]);
      if (existingUser.rowCount && (!invite.rowCount || Number(invite.rows[0].user_id) !== Number(existingUser.rows[0].id) || !["professor","applicant"].includes(existingUser.rows[0].role) || !existingUser.rows[0].is_active)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "email_already_used", message: "Cette adresse possède déjà un compte qui n’est pas relié à cette fiche professeur ou qui est suspendu." });
      }
      if (invite.rowCount && !invite.rows[0].is_active) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "professor_invite_inactive" });
      }
      let inviteId;
      if (invite.rowCount) {
        inviteId = invite.rows[0].id;
      } else {
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
      if (existingUser.rowCount) {
        await client.query("UPDATE role_assignments SET status='active',revoked_at=NULL,updated_at=NOW() WHERE user_id=$1 AND role='professor'", [existingUser.rows[0].id]);
      }
      await client.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata) VALUES($1,'professor.course_assigned','professor_invite',$2,$3,$4,$5,$6,$7::jsonb)",
        [req.user.id,inviteId,course.rows[0].university_id,course.rows[0].faculty_id,course.rows[0].option_id,course.rows[0].study_level_id,JSON.stringify({ courseId })]
      );
      await client.query("COMMIT");
      return res.status(201).json({ message: existingUser.rowCount ? "Cours ajouté au compte professeur existant." : invite.rowCount ? "Cours ajouté au professeur déjà déclaré." : "Professeur déclaré. Il peut activer son compte après confirmation de son e-mail." });
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


  router.get("/program-manager/documents/:id/download", requireAuth, requireProgramManager, async (req, res) => {
    const documentId = positiveId(req.params.id);
    if (!documentId) return res.status(400).json({ error: "invalid_document_id" });
    try {
      const result = await pool.query(`SELECT d.id,d.file_key,d.file_name,d.mime_type,d.storage_bucket
        FROM documents d
        JOIN options o ON o.id=d.option_id JOIN faculties f ON f.id=o.faculty_id
        WHERE d.id=$1 AND d.is_active=TRUE AND d.status='approved'
          AND d.storage_bucket='class-documents'
          AND d.university_id=f.university_id AND d.faculty_id=f.id
          AND EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id=$2
            AND ra.role='program_manager' AND ra.status='active'
            AND ra.university_id=d.university_id AND ra.faculty_id=d.faculty_id
            AND ra.option_id=d.option_id AND (ra.study_level_id IS NULL OR ra.study_level_id=d.study_level_id))`,
        [documentId,req.user.id]
      );
      if (!result.rowCount) return res.status(404).json({ error: "document_not_found" });
      if (typeof readPrivateObject !== "function") return res.status(503).json({ error: "document_storage_unavailable" });
      const row=result.rows[0];
      const file=await readPrivateObject(row.file_key,row.storage_bucket);
      const safeName=(row.file_name || ("ifac-document-"+row.id+".pdf")).replace(/[\\r\\n"]/g,"_");
      res.set("Content-Type",row.mime_type || "application/pdf");
      res.set("Content-Length",String(file.length));
      res.set("Content-Disposition","attachment; filename=\"ifac-document-"+row.id+".pdf\"; filename*=UTF-8''"+encodeURIComponent(safeName));
      res.set("X-Content-Type-Options","nosniff");
      res.set("Cache-Control","private, no-store");
      return res.send(file);
    } catch (error) {
      console.error("Téléchargement programme échoué:",error?.message);
      return res.status(503).json({ error: "program_document_download_failed" });
    }
  });

  return router;
}

import express from "express";

const idOf = value => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validCode = value => /^[A-Z0-9_-]{2,32}$/.test(value);

export function createUniversityCatalogRouter({ pool, requireAuth }) {
  const router = express.Router();

  async function requireUniversityAdmin(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT ra.id AS assignment_id, ra.university_id, u.name AS university_name,
                u.registration_enabled
         FROM role_assignments ra
         JOIN universities u ON u.id = ra.university_id
         WHERE ra.user_id = $1 AND ra.role = 'university_admin'
           AND ra.status = 'active' AND u.is_active = TRUE
         ORDER BY u.name, ra.id`,
        [req.user.id]
      );
      if (!result.rowCount) {
        return res.status(403).json({ error: "university_admin_required" });
      }
      req.universityScopes = result.rows;
      next();
    } catch {
      return res.status(503).json({ error: "university_scope_unavailable" });
    }
  }

  const guard = [requireAuth, requireUniversityAdmin];
  const scopeFor = (req, assignmentId) => {
    if (assignmentId) {
      return req.universityScopes.find(scope => Number(scope.assignment_id) === assignmentId) || null;
    }
    return req.universityScopes.length === 1 ? req.universityScopes[0] : null;
  };
  const scopeIds = req => req.universityScopes.map(scope => scope.university_id);

  async function audit(client, req, action, type, id, universityId, facultyId = null, optionId = null, metadata = {}) {
    await client.query(
      `INSERT INTO admin_audit_logs
       (actor_user_id, action, target_type, target_id, university_id, faculty_id, option_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [req.user.id, action, type, id, universityId, facultyId, optionId, JSON.stringify(metadata)]
    );
  }

  router.get("/university-admin/catalog", ...guard, async (req, res) => {
    try {
      const ids = scopeIds(req);
      const [faculties, options, levels] = await Promise.all([
        pool.query(
          "SELECT id,university_id,code,name,is_active FROM faculties WHERE university_id=ANY($1::bigint[]) ORDER BY university_id,name",
          [ids]
        ),
        pool.query(
          `SELECT o.id,o.faculty_id,o.code,o.name,o.is_active,f.university_id
           FROM options o JOIN faculties f ON f.id=o.faculty_id
           WHERE f.university_id=ANY($1::bigint[]) ORDER BY f.university_id,f.name,o.name`,
          [ids]
        ),
        pool.query(
          `SELECT l.id,l.option_id,l.code,l.label,l.sort_order,l.is_active,
                  f.university_id,o.faculty_id
           FROM study_levels l JOIN options o ON o.id=l.option_id
           JOIN faculties f ON f.id=o.faculty_id
           WHERE f.university_id=ANY($1::bigint[])
           ORDER BY f.university_id,f.name,o.name,l.sort_order`,
          [ids]
        )
      ]);
      res.set("Cache-Control", "no-store");
      return res.json({ data: { faculties: faculties.rows, options: options.rows, levels: levels.rows }, scopes: req.universityScopes });
    } catch {
      return res.status(503).json({ error: "university_catalog_unavailable" });
    }
  });

  router.post("/university-admin/faculties", ...guard, async (req, res) => {
    const scope = scopeFor(req, idOf(req.body?.scopeAssignmentId));
    const code = clean(req.body?.code, 32).toUpperCase();
    const name = clean(req.body?.name, 180);
    if (!scope) return res.status(400).json({ error: "university_scope_selection_required", message: "Sélectionnez une université que vous administrez." });
    if (!validCode(code) || name.length < 2) return res.status(400).json({ error: "invalid_faculty" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "INSERT INTO faculties(university_id,code,name,is_active) VALUES($1,$2,$3,TRUE) RETURNING id,university_id,code,name,is_active",
        [scope.university_id, code, name]
      );
      await audit(client, req, "academic.faculty_created", "faculty", result.rows[0].id, scope.university_id, null, null, { code, name });
      await client.query("COMMIT");
      return res.status(201).json({ faculty: result.rows[0], message: "Faculté créée." });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") return res.status(409).json({ error: "faculty_already_exists", message: "Ce code ou ce nom de faculté existe déjà dans cette université." });
      return res.status(503).json({ error: "faculty_create_failed" });
    } finally { client.release(); }
  });

  router.patch("/university-admin/faculties/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id);
    const code = clean(req.body?.code, 32).toUpperCase();
    const name = clean(req.body?.name, 180);
    const active = req.body?.isActive;
    if (!id || !validCode(code) || name.length < 2 || typeof active !== "boolean") return res.status(400).json({ error: "invalid_faculty_update" });
    try {
      const result = await pool.query(
        `UPDATE faculties SET code=$1,name=$2,is_active=$3,updated_at=NOW()
         WHERE id=$4 AND university_id=ANY($5::bigint[])
         RETURNING id,university_id,code,name,is_active`,
        [code, name, active, id, scopeIds(req)]
      );
      if (!result.rowCount) return res.status(404).json({ error: "faculty_not_found" });
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,metadata) VALUES($1,'academic.faculty_updated','faculty',$2,$3,$4::jsonb)",
        [req.user.id, id, result.rows[0].university_id, JSON.stringify({ code, name, isActive: active })]
      );
      return res.json({ faculty: result.rows[0], message: "Faculté mise à jour." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "faculty_already_exists" });
      return res.status(503).json({ error: "faculty_update_failed" });
    }
  });

  router.delete("/university-admin/faculties/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_faculty_id" });
    try {
      const result = await pool.query(
        "UPDATE faculties SET is_active=FALSE,updated_at=NOW() WHERE id=$1 AND university_id=ANY($2::bigint[]) RETURNING id,university_id",
        [id, scopeIds(req)]
      );
      if (!result.rowCount) return res.status(404).json({ error: "faculty_not_found" });
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,metadata) VALUES($1,'academic.faculty_deactivated','faculty',$2,$3,'{}'::jsonb)",
        [req.user.id, id, result.rows[0].university_id]
      );
      return res.json({ message: "Faculté désactivée. Les données historiques sont conservées." });
    } catch { return res.status(503).json({ error: "faculty_deactivate_failed" }); }
  });

  router.post("/university-admin/options", ...guard, async (req, res) => {
    const facultyId = idOf(req.body?.facultyId);
    const code = clean(req.body?.code, 32).toUpperCase();
    const name = clean(req.body?.name, 180);
    if (!facultyId || !validCode(code) || name.length < 2) return res.status(400).json({ error: "invalid_option" });
    try {
      const faculty = await pool.query(
        "SELECT id,university_id FROM faculties WHERE id=$1 AND university_id=ANY($2::bigint[]) AND is_active=TRUE",
        [facultyId, scopeIds(req)]
      );
      if (!faculty.rowCount) return res.status(404).json({ error: "faculty_not_found" });
      const result = await pool.query(
        "INSERT INTO options(faculty_id,code,name,is_active) VALUES($1,$2,$3,TRUE) RETURNING id,faculty_id,code,name,is_active",
        [facultyId, code, name]
      );
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,metadata) VALUES($1,'academic.option_created','option',$2,$3,$4,$5::jsonb)",
        [req.user.id, result.rows[0].id, faculty.rows[0].university_id, facultyId, JSON.stringify({ code, name })]
      );
      return res.status(201).json({ option: result.rows[0], message: "Option créée." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "option_already_exists" });
      return res.status(503).json({ error: "option_create_failed" });
    }
  });

  router.patch("/university-admin/options/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id), code = clean(req.body?.code, 32).toUpperCase();
    const name = clean(req.body?.name, 180), active = req.body?.isActive;
    if (!id || !validCode(code) || name.length < 2 || typeof active !== "boolean") return res.status(400).json({ error: "invalid_option_update" });
    try {
      const result = await pool.query(
        `UPDATE options o SET code=$1,name=$2,is_active=$3
         FROM faculties f WHERE o.id=$4 AND f.id=o.faculty_id
           AND f.university_id=ANY($5::bigint[])
         RETURNING o.id,o.faculty_id,o.code,o.name,o.is_active`,
        [code, name, active, id, scopeIds(req)]
      );
      if (!result.rowCount) return res.status(404).json({ error: "option_not_found" });
      return res.json({ option: result.rows[0], message: "Option mise à jour." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "option_already_exists" });
      return res.status(503).json({ error: "option_update_failed" });
    }
  });

  router.delete("/university-admin/options/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_option_id" });
    try {
      const result = await pool.query(
        `UPDATE options o SET is_active=FALSE FROM faculties f
         WHERE o.id=$1 AND f.id=o.faculty_id AND f.university_id=ANY($2::bigint[])
         RETURNING o.id`,
        [id, scopeIds(req)]
      );
      if (!result.rowCount) return res.status(404).json({ error: "option_not_found" });
      return res.json({ message: "Option désactivée. Les données historiques sont conservées." });
    } catch { return res.status(503).json({ error: "option_deactivate_failed" }); }
  });

  router.post("/university-admin/levels", ...guard, async (req, res) => {
    const optionId = idOf(req.body?.optionId), code = clean(req.body?.code, 16).toUpperCase();
    const label = clean(req.body?.label, 80), sortOrder = Number(req.body?.sortOrder);
    if (!optionId || !/^[A-Z0-9_-]{1,16}$/.test(code) || label.length < 1 || !Number.isSafeInteger(sortOrder) || sortOrder < 1 || sortOrder > 100) {
      return res.status(400).json({ error: "invalid_study_level" });
    }
    try {
      const option = await pool.query(
        `SELECT o.id,o.faculty_id,f.university_id FROM options o JOIN faculties f ON f.id=o.faculty_id
         WHERE o.id=$1 AND f.university_id=ANY($2::bigint[]) AND o.is_active=TRUE AND f.is_active=TRUE`,
        [optionId, scopeIds(req)]
      );
      if (!option.rowCount) return res.status(404).json({ error: "option_not_found" });
      const result = await pool.query(
        "INSERT INTO study_levels(option_id,code,label,sort_order,is_active) VALUES($1,$2,$3,$4,TRUE) RETURNING id,option_id,code,label,sort_order,is_active",
        [optionId, code, label, sortOrder]
      );
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,metadata) VALUES($1,'academic.level_created','study_level',$2,$3,$4,$5,$6::jsonb)",
        [req.user.id, result.rows[0].id, option.rows[0].university_id, option.rows[0].faculty_id, optionId, JSON.stringify({ code, label, sortOrder })]
      );
      return res.status(201).json({ level: result.rows[0], message: "Niveau d’études créé." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "study_level_already_exists" });
      return res.status(503).json({ error: "study_level_create_failed" });
    }
  });

  router.patch("/university-admin/levels/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id), code = clean(req.body?.code, 16).toUpperCase();
    const label = clean(req.body?.label, 80), sortOrder = Number(req.body?.sortOrder), active = req.body?.isActive;
    if (!id || !/^[A-Z0-9_-]{1,16}$/.test(code) || !label || !Number.isSafeInteger(sortOrder) || sortOrder < 1 || sortOrder > 100 || typeof active !== "boolean") return res.status(400).json({ error: "invalid_study_level_update" });
    try {
      const result = await pool.query(
        `UPDATE study_levels l SET code=$1,label=$2,sort_order=$3,is_active=$4
         FROM options o JOIN faculties f ON f.id=o.faculty_id
         WHERE l.id=$5 AND o.id=l.option_id AND f.university_id=ANY($6::bigint[])
         RETURNING l.id,l.option_id,l.code,l.label,l.sort_order,l.is_active`,
        [code, label, sortOrder, active, id, scopeIds(req)]
      );
      if (!result.rowCount) return res.status(404).json({ error: "study_level_not_found" });
      return res.json({ level: result.rows[0], message: "Niveau d’études mis à jour." });
    } catch (error) {
      if (error?.code === "23505") return res.status(409).json({ error: "study_level_already_exists" });
      return res.status(503).json({ error: "study_level_update_failed" });
    }
  });

  router.delete("/university-admin/levels/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_study_level_id" });
    try {
      const result = await pool.query(
        `UPDATE study_levels l SET is_active=FALSE FROM options o JOIN faculties f ON f.id=o.faculty_id
         WHERE l.id=$1 AND o.id=l.option_id AND f.university_id=ANY($2::bigint[])
         RETURNING l.id`,
        [id, scopeIds(req)]
      );
      if (!result.rowCount) return res.status(404).json({ error: "study_level_not_found" });
      return res.json({ message: "Niveau désactivé. Les données historiques sont conservées." });
    } catch { return res.status(503).json({ error: "study_level_deactivate_failed" }); }
  });

  router.post("/university-admin/registration/enable", ...guard, async (req, res) => {
    const scope = scopeFor(req, idOf(req.body?.scopeAssignmentId));
    if (!scope) return res.status(400).json({ error: "university_scope_selection_required" });
    try {
      const counts = await pool.query(
        `SELECT COUNT(DISTINCT f.id)::int faculties,
                COUNT(DISTINCT o.id)::int options,
                COUNT(DISTINCT l.id)::int levels
         FROM faculties f
         LEFT JOIN options o ON o.faculty_id=f.id AND o.is_active=TRUE
         LEFT JOIN study_levels l ON l.option_id=o.id AND l.is_active=TRUE
         WHERE f.university_id=$1 AND f.is_active=TRUE`,
        [scope.university_id]
      );
      const c = counts.rows[0];
      if (!c.faculties || !c.options || !c.levels) {
        return res.status(409).json({
          error: "academic_catalog_incomplete",
          message: "Ajoutez au moins une faculté active, une option active et un niveau d’études actif avant d’ouvrir les inscriptions.",
          counts: c
        });
      }
      const result = await pool.query(
        "UPDATE universities SET registration_enabled=TRUE,updated_at=NOW() WHERE id=$1 RETURNING id,name,registration_enabled",
        [scope.university_id]
      );
      await pool.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,metadata) VALUES($1,'university.registration_enabled','university',$2,$2,'{}'::jsonb)",
        [req.user.id, scope.university_id]
      );
      return res.json({ university: result.rows[0], message: "Les inscriptions étudiantes sont maintenant ouvertes." });
    } catch { return res.status(503).json({ error: "registration_enable_failed" }); }
  });

  return router;
}

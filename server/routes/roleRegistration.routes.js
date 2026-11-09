import express from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const validEmail = value => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function normalizeResponsibleScope(body = {}) {
  const role = typeof body.role === "string" ? body.role.trim() : "";
  if (!["university_admin", "faculty_manager", "program_manager"].includes(role)) return null;
  const universityId = positiveId(body.universityId);
  if (!universityId) return null;
  if (role === "university_admin") return { role, universityId, facultyId: null, optionId: null, studyLevelId: null };
  const facultyId = positiveId(body.facultyId);
  if (!facultyId) return null;
  if (role === "faculty_manager") return { role, universityId, facultyId, optionId: null, studyLevelId: null };
  const optionId = positiveId(body.optionId);
  if (!optionId) return null;
  const studyLevelId = body.studyLevelId ? positiveId(body.studyLevelId) : null;
  if (body.studyLevelId && !studyLevelId) return null;
  return { role, universityId, facultyId, optionId, studyLevelId };
}

export function createRoleRegistrationRouter({ pool }) {
  const router = express.Router();
  router.post("/auth/responsible/register", async (req, res) => {
    if (!pool) return res.status(503).json({ error: "service_unavailable" });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const password = req.body?.password;
    const scope = normalizeResponsibleScope(req.body || {});
    if (!validEmail(email) || !firstName || firstName.length > 100 || !lastName || lastName.length > 100 ||
        typeof password !== "string" || password.length < 10 || password.length > 128 || !scope) {
      return res.status(400).json({ error: "invalid_responsible_registration", message: "Renseignez votre identité, votre mot de passe et le périmètre de responsabilité demandé." });
    }
    try {
      const existing = await pool.query("SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1", [email]);
      if (existing.rowCount) return res.status(409).json({
        error: "email_already_registered",
        message: "Cette adresse possède déjà un compte iFac. Connectez-vous avec ce compte au lieu d’en créer un second."
      });
      let validScope;
      if (scope.role === "university_admin") {
        validScope = await pool.query("SELECT id FROM universities WHERE id=$1 AND is_active=TRUE", [scope.universityId]);
      } else if (scope.role === "faculty_manager") {
        validScope = await pool.query(
          "SELECT f.id FROM faculties f JOIN universities u ON u.id=f.university_id WHERE u.id=$1 AND f.id=$2 AND u.is_active=TRUE AND f.is_active=TRUE",
          [scope.universityId, scope.facultyId]
        );
      } else {
        validScope = await pool.query(
          "SELECT o.id FROM options o JOIN faculties f ON f.id=o.faculty_id JOIN universities u ON u.id=f.university_id LEFT JOIN study_levels l ON l.option_id=o.id AND l.id=$4 WHERE u.id=$1 AND f.id=$2 AND o.id=$3 AND u.is_active=TRUE AND f.is_active=TRUE AND o.is_active=TRUE AND ($4::bigint IS NULL OR l.id IS NOT NULL)",
          [scope.universityId, scope.facultyId, scope.optionId, scope.studyLevelId]
        );
      }
      if (!validScope.rowCount) return res.status(400).json({
        error: "invalid_responsible_scope",
        message: "Le périmètre choisi ne correspond pas à la structure universitaire active."
      });
      const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
      const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
      if (!supabaseUrl || !apiKey) return res.status(503).json({ error: "auth_not_configured" });
      const verifyUrl = new URL("/verify-email", process.env.APP_BASE_URL || "http://localhost:3435");
      const auth = await fetch(supabaseUrl + "/auth/v1/signup?redirect_to=" + encodeURIComponent(verifyUrl.toString()), {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, data: { first_name: firstName, last_name: lastName, role: "applicant", requested_role: scope.role } })
      });
      const authData = await auth.json().catch(() => ({}));
      if (!auth.ok) {
        const detail = String(authData.code || authData.error_code || authData.msg || authData.message || "");
        if (auth.status === 429) return res.status(429).json({ error: "email_rate_limited", message: "Trop de demandes. Réessayez plus tard." });
        if (/already registered|already been registered|user already exists|email_exists/i.test(detail)) {
          return res.status(409).json({ error: "email_already_registered", message: "Cette adresse possède déjà un compte d’authentification." });
        }
        console.error("Inscription responsable Supabase:", auth.status, detail);
        return res.status(503).json({ error: "responsible_registration_unavailable", message: "Le compte n’a pas pu être créé. Vérifiez le service de confirmation e-mail." });
      }
      const authUserId = authData.user?.id ||
        (await pool.query("SELECT id FROM auth.users WHERE lower(email)=lower($1) LIMIT 1", [email])).rows[0]?.id;
      if (!authUserId) return res.status(503).json({ error: "responsible_auth_identity_unavailable" });
      const hash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const user = await client.query(
          "INSERT INTO users(auth_user_id,university_id,faculty_id,option_id,study_level_id,first_name,last_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'applicant') RETURNING id",
          [authUserId, scope.universityId, scope.facultyId, scope.optionId, scope.studyLevelId, firstName, lastName, email, hash]
        );
        const assignment = await client.query(
          "INSERT INTO role_assignments(user_id,role,university_id,faculty_id,option_id,study_level_id,status) VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING id",
          [user.rows[0].id, scope.role, scope.universityId, scope.facultyId, scope.optionId, scope.studyLevelId]
        );
        await client.query(
          "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata) VALUES($1,'role_application.submitted','role_assignment',$2,$3,$4,$5,$6,$7::jsonb)",
          [user.rows[0].id, assignment.rows[0].id, scope.universityId, scope.facultyId, scope.optionId, scope.studyLevelId, JSON.stringify({ role: scope.role })]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (error?.code === "23505") return res.status(409).json({ error: "responsible_request_exists", message: "Une demande existe déjà pour ce compte et ce périmètre." });
        throw error;
      } finally {
        client.release();
      }
      const label = { university_admin: "responsable d’université", faculty_manager: "responsable de faculté", program_manager: "responsable de programme" }[scope.role];
      return res.status(201).json({ message: "Compte créé. Confirmez votre adresse e-mail. Votre demande pour devenir " + label + " est en attente de validation par votre hiérarchie." });
    } catch (error) {
      console.error("Inscription responsable:", error?.message || error);
      return res.status(503).json({ error: "responsible_registration_unavailable", message: "L’inscription est temporairement indisponible." });
    }
  });
  return router;
}

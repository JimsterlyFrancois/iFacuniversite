import express from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const validEmail = value =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export function normalizeRoleRequest(body = {}) {
  const role = typeof body.role === "string" ? body.role.trim() : "";
  if (!["professor","university_admin","faculty_manager","program_manager"].includes(role)) return null;
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
  if (role === "professor" && !studyLevelId) return null;
  return { role, universityId, facultyId, optionId, studyLevelId };
}

async function validateScope(pool, scope) {
  if (scope.role === "university_admin") {
    const result = await pool.query("SELECT id FROM universities WHERE id=$1 AND is_active=TRUE", [scope.universityId]);
    return result.rowCount > 0;
  }
  if (scope.role === "faculty_manager") {
    const result = await pool.query(\`SELECT f.id FROM faculties f JOIN universities u ON u.id=f.university_id
      WHERE u.id=$1 AND f.id=$2 AND u.is_active=TRUE AND f.is_active=TRUE\`, [scope.universityId, scope.facultyId]);
    return result.rowCount > 0;
  }
  const result = await pool.query(\`SELECT o.id FROM options o
    JOIN faculties f ON f.id=o.faculty_id JOIN universities u ON u.id=f.university_id
    LEFT JOIN study_levels l ON l.option_id=o.id AND l.id=$4
    WHERE u.id=$1 AND f.id=$2 AND o.id=$3 AND u.is_active=TRUE AND f.is_active=TRUE AND o.is_active=TRUE
      AND ($4::bigint IS NULL OR (l.id IS NOT NULL AND l.is_active=TRUE))\`,
    [scope.universityId,scope.facultyId,scope.optionId,scope.studyLevelId]);
  return result.rowCount > 0;
}

export function createRoleRegistrationRouter({ pool }) {
  const router = express.Router();

  async function registerApplicant(req, res, scope) {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const password = req.body?.password;
    if (!validEmail(email) || !firstName || firstName.length > 100 || !lastName || lastName.length > 100 ||
        typeof password !== "string" || password.length < 10 || password.length > 128 || !scope) {
      return res.status(400).json({ error: "invalid_role_registration", message: "Renseignez votre identité, un mot de passe valide et le périmètre universitaire demandé." });
    }

    try {
      const existing = await pool.query("SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1", [email]);
      if (existing.rowCount) return res.status(409).json({
        error: "email_already_registered",
        message: "Cette adresse possède déjà un compte iFac. Connectez-vous avec ce compte au lieu d’en créer un second."
      });
      if (!(await validateScope(pool, scope))) return res.status(400).json({
        error: "invalid_role_scope",
        message: "Le périmètre choisi ne correspond pas à la structure universitaire active."
      });

      const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
      const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
      if (!supabaseUrl || !apiKey) return res.status(503).json({ error: "auth_not_configured" });
      const verifyUrl = new URL("/verify-email", process.env.APP_BASE_URL || "http://localhost:3435");
      const authResponse = await fetch(supabaseUrl + "/auth/v1/signup?redirect_to=" + encodeURIComponent(verifyUrl.toString()), {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, data: { first_name: firstName, last_name: lastName, role: "applicant", requested_role: scope.role } })
      });
      const authData = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok) {
        const detail = String(authData.code || authData.error_code || authData.msg || authData.message || "");
        if (authResponse.status === 429) return res.status(429).json({ error: "email_rate_limited", message: "Trop de demandes. Réessayez plus tard." });
        if (/already registered|already been registered|user already exists|email_exists/i.test(detail)) return res.status(409).json({
          error: "email_already_registered", message: "Cette adresse possède déjà un compte d’authentification."
        });
        console.error("Création Auth demande de rôle:", authResponse.status, detail);
        return res.status(503).json({ error: "role_registration_unavailable", message: "Le compte n’a pas pu être créé. Vérifiez le service de confirmation e-mail." });
      }

      const authUserId = authData.user?.id ||
        (await pool.query("SELECT id FROM auth.users WHERE lower(email)=lower($1) LIMIT 1", [email])).rows[0]?.id;
      if (!authUserId) return res.status(503).json({
        error: "auth_identity_unavailable", message: "L’identifiant du compte est indisponible. Contactez l’administration."
      });

      const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const created = await client.query(\`INSERT INTO users(
          auth_user_id,university_id,faculty_id,option_id,study_level_id,
          first_name,last_name,email,password_hash,role
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'applicant') RETURNING id\`, [
          authUserId,scope.universityId,scope.facultyId,scope.optionId,scope.studyLevelId,
          firstName,lastName,email,passwordHash
        ]);
        const userId = created.rows[0].id;
        let assignmentId;
        if (scope.role === "professor") {
          const invite = await client.query(\`INSERT INTO professor_invites(
            email,first_name,last_name,user_id,activated_at,is_active
          ) VALUES($1,$2,$3,$4,NOW(),TRUE) RETURNING id\`, [email,firstName,lastName,userId]);
          await client.query(\`INSERT INTO professor_assignments(
            invite_id,university_id,faculty_id,option_id,study_level_id,course_id,is_active,assigned_by
          ) VALUES($1,$2,$3,$4,$5,NULL,TRUE,NULL)\`, [
            invite.rows[0].id,scope.universityId,scope.facultyId,scope.optionId,scope.studyLevelId
          ]);
          const roleAssignment = await client.query(
            "INSERT INTO role_assignments(user_id,role,status) VALUES($1,'professor','pending') RETURNING id",
            [userId]
          );
          assignmentId = roleAssignment.rows[0].id;
        } else {
          const roleAssignment = await client.query(\`INSERT INTO role_assignments(
            user_id,role,university_id,faculty_id,option_id,study_level_id,status
          ) VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING id\`, [
            userId,scope.role,scope.universityId,scope.facultyId,scope.optionId,scope.studyLevelId
          ]);
          assignmentId = roleAssignment.rows[0].id;
        }
        await client.query(\`INSERT INTO admin_audit_logs(
          actor_user_id,action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata
        ) VALUES($1,'role_application.submitted','role_assignment',$2,$3,$4,$5,$6,$7::jsonb)\`, [
          userId,assignmentId,scope.universityId,scope.facultyId,scope.optionId,scope.studyLevelId,
          JSON.stringify({ role: scope.role })
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (error?.code === "23505") return res.status(409).json({
          error: "role_request_exists", message: "Une demande existe déjà pour cette adresse et ce périmètre."
        });
        throw error;
      } finally {
        client.release();
      }

      const labels = {
        professor: "professeur",
        university_admin: "responsable d’université",
        faculty_manager: "responsable de faculté",
        program_manager: "responsable de programme"
      };
      return res.status(201).json({
        message: "Compte créé. Confirmez votre adresse e-mail. Votre demande pour devenir " +
          labels[scope.role] + " est en attente de validation par l’autorité compétente."
      });
    } catch (error) {
      console.error("Inscription demande de rôle:", error?.message || error);
      return res.status(503).json({ error: "role_registration_unavailable", message: "L’inscription est temporairement indisponible." });
    }
  }

  router.post("/auth/professor/register", async (req,res) => {
    if (!pool) return res.status(503).json({ error: "service_unavailable" });
    return registerApplicant(req,res,normalizeRoleRequest({ ...req.body, role: "professor" }));
  });
  router.post("/auth/responsible/register", async (req,res) => {
    if (!pool) return res.status(503).json({ error: "service_unavailable" });
    const scope = normalizeRoleRequest(req.body || {});
    if (!scope || scope.role === "professor") return res.status(400).json({
      error: "invalid_responsible_role", message: "Sélectionnez une responsabilité universitaire autorisée."
    });
    return registerApplicant(req,res,scope);
  });
  return router;
}

import express from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const positiveId = value => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const optionalId = value => value === undefined || value === null || value === "" ? null : positiveId(value);
const emailIsValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function createRoleRegistrationRouter({ pool, supabaseAuth }) {
  const router = express.Router();

  router.post("/auth/responsible/register", async (req, res) => {
    if (!pool) return res.status(503).json({ error: "service_unavailable" });

    const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
    const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = req.body?.password;
    const role = req.body?.role;
    const universityId = positiveId(req.body?.universityId);
    const facultyId = optionalId(req.body?.facultyId);
    const optionId = optionalId(req.body?.optionId);
    const studyLevelId = optionalId(req.body?.studyLevelId);
    const rawIds = [req.body?.facultyId, req.body?.optionId, req.body?.studyLevelId];
    const parsedIds = [facultyId, optionId, studyLevelId];

    if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100 ||
        !emailIsValid(email) || email.length > 254 ||
        typeof password !== "string" || password.length < 10 || password.length > 128 ||
        !universityId || rawIds.some((value, index) =>
          value !== undefined && value !== null && value !== "" && parsedIds[index] === null) ||
        !["university_admin", "faculty_manager", "program_manager"].includes(role)) {
      return res.status(400).json({
        error: "invalid_responsible_registration",
        message: "Vérifiez votre identité, votre université, votre fonction et les champs obligatoires."
      });
    }

    const scopeIsValid =
      (role === "university_admin" && !facultyId && !optionId && !studyLevelId) ||
      (role === "faculty_manager" && Boolean(facultyId) && !optionId && !studyLevelId) ||
      (role === "program_manager" && Boolean(facultyId) && Boolean(optionId));

    if (!scopeIsValid) {
      return res.status(400).json({
        error: "invalid_responsible_scope",
        message: "La fonction choisie ne correspond pas aux champs universitaires renseignés."
      });
    }

    try {
      const profile = await pool.query(
        `SELECT u.id AS university_id, f.id AS faculty_id, o.id AS option_id, l.id AS study_level_id
         FROM universities u
         LEFT JOIN faculties f ON f.id=$2 AND f.university_id=u.id AND f.is_active=TRUE
         LEFT JOIN options o ON o.id=$3 AND o.faculty_id=f.id AND o.is_active=TRUE
         LEFT JOIN study_levels l ON l.id=$4 AND l.option_id=o.id AND l.is_active=TRUE
         WHERE u.id=$1 AND u.is_active=TRUE`,
        [universityId, facultyId, optionId, studyLevelId]
      );
      const selected = profile.rows[0];
      const hierarchyIsValid = selected &&
        (role === "university_admin" ||
          (role === "faculty_manager" && String(selected.faculty_id) === String(facultyId)) ||
          (role === "program_manager" &&
            String(selected.faculty_id) === String(facultyId) &&
            String(selected.option_id) === String(optionId) &&
            (!studyLevelId || String(selected.study_level_id) === String(studyLevelId))));

      if (!hierarchyIsValid) {
        return res.status(400).json({
          error: "invalid_responsible_scope",
          message: "La faculté, l’option ou le niveau ne correspond pas à cette université."
        });
      }

      const existing = await pool.query(
        "SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1",
        [email]
      );
      if (existing.rowCount) {
        return res.status(409).json({
          error: "email_already_registered",
          message: "Cette adresse e-mail possède déjà un compte iFac."
        });
      }

      const verificationUrl = new URL("/verify-email", process.env.APP_BASE_URL || "http://localhost:3435");
      const signup = await supabaseAuth(
        `/signup?redirect_to=${encodeURIComponent(verificationUrl.toString())}`,
        {
          method: "POST",
          body: {
            email,
            password,
            data: { first_name: firstName, last_name: lastName, role: "responsible_applicant" }
          }
        }
      );

      if (!signup.response.ok) {
        const detail = String(signup.data?.code || signup.data?.error_code || signup.data?.msg || signup.data?.message || "");
        if (signup.response.status === 429) {
          return res.status(429).json({ error: "email_rate_limited", message: "Trop de demandes. Réessayez plus tard." });
        }
        if (/already registered|already been registered|user already exists|email_exists/i.test(detail)) {
          return res.status(409).json({
            error: "email_already_registered",
            message: "Cette adresse e-mail possède déjà un compte d’authentification."
          });
        }
        console.error("Inscription responsable Supabase:", signup.response.status, detail);
        return res.status(503).json({
          error: "responsible_registration_unavailable",
          message: "Le compte n’a pas pu être créé. Vérifiez le service de confirmation e-mail."
        });
      }

      const authUserId = signup.data?.user?.id;
      if (typeof authUserId !== "string") {
        return res.status(503).json({
          error: "auth_identity_unavailable",
          message: "Supabase n’a pas retourné l’identifiant sécurisé du compte."
        });
      }

      const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const created = await client.query(
          `INSERT INTO users
           (auth_user_id,university_id,faculty_id,option_id,study_level_id,first_name,last_name,email,password_hash,role)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'student') RETURNING id`,
          [authUserId, universityId, facultyId, optionId, studyLevelId, firstName, lastName, email, passwordHash]
        );
        const assignment = await client.query(
          `INSERT INTO role_assignments
           (user_id,role,university_id,faculty_id,option_id,study_level_id,status)
           VALUES($1,$2,$3,$4,$5,$6,'pending') RETURNING id,status`,
          [created.rows[0].id, role, universityId, facultyId, optionId, studyLevelId]
        );
        await client.query(
          `INSERT INTO admin_audit_logs
           (action,target_type,target_id,university_id,faculty_id,option_id,study_level_id,metadata)
           VALUES('role.application_submitted','role_assignment',$1,$2,$3,$4,$5,$6::jsonb)`,
          [assignment.rows[0].id, universityId, facultyId, optionId, studyLevelId,
            JSON.stringify({ role, email })]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }

      const messages = {
        university_admin: "Compte créé. Confirmez votre e-mail. Votre demande de responsable d’université attend la validation de l’administration générale iFac.",
        faculty_manager: "Compte créé. Confirmez votre e-mail. Votre demande de responsable de faculté attend la validation de l’administration de votre université.",
        program_manager: "Compte créé. Confirmez votre e-mail. Votre demande de responsable de programme attend la validation du responsable de votre faculté."
      };
      return res.status(201).json({ message: messages[role], status: "pending" });
    } catch (error) {
      console.error("Inscription responsable:", error?.message || error);
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "email_already_registered",
          message: "Cette adresse e-mail ou cette demande est déjà enregistrée."
        });
      }
      return res.status(503).json({
        error: "responsible_registration_unavailable",
        message: "L’inscription est temporairement indisponible."
      });
    }
  });

  return router;
}

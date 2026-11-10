import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import nodemailer from "nodemailer";
import { updateSupabaseUserPassword } from "./lib/supabaseAdmin.js";
import { requireGeneralAdmin } from "./lib/roleAuthorization.js";
import { listRegistrableUniversities, findActiveAcademicProfile } from "./lib/registrationCatalog.js";
import { resolveAuthUserId } from "./lib/authIdentity.js";
import multer from "multer";
import { createClassDocumentsRouter } from "./routes/classDocuments.routes.js";
import { createProfessorsRouter } from "./routes/professors.routes.js";
import { createRoleRegistrationRouter } from "./routes/roleRegistration.routes.js";
import { createProgramManagerRouter } from "./routes/programManager.routes.js";
import { createFacultyManagerRouter } from "./routes/facultyManager.routes.js";
import { createUniversityAdminRouter } from "./routes/universityAdmin.routes.js";
import { createUniversityCatalogRouter } from "./routes/universityCatalog.routes.js";
import { createGeneralAdminRouter } from "./routes/generalAdmin.routes.js";
import { mkdir } from "node:fs/promises";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT) || 3434;
const here = path.dirname(fileURLToPath(import.meta.url));
const privateFilesDir = path.resolve(process.env.FILE_STORAGE_DIR || path.join(here, "private-uploads"));
if (!process.env.SUPABASE_URL) await mkdir(privateFilesDir, { recursive: true });
const storageUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const storageKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "ifac-documents";
const announcementStorageBucket = process.env.SUPABASE_ANNOUNCEMENTS_BUCKET || "ifac-announcements";
const persistentStorageReady = Boolean(storageUrl && storageKey && storageBucket);
function storageObjectUrl(key, bucket = storageBucket) {
  return `${storageUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
async function storePrivateObject(key, buffer, contentType, bucket = storageBucket) {
  if (!persistentStorageReady) throw new Error("persistent_storage_not_configured");
  const response = await fetch(storageObjectUrl(key, bucket), { method: "POST", headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}`, "Content-Type": contentType, "x-upsert": "false" }, body: buffer });
  if (!response.ok) throw new Error(`storage_upload_failed_${response.status}`);
}
async function readPrivateObject(key, bucket = storageBucket) {
  if (!persistentStorageReady) throw new Error("persistent_storage_not_configured");
  // Private objects must be read through Storage's authenticated download route.
  // The plain /object/{bucket}/{path} route is used for uploads and is not the
  // correct endpoint for serving a private image or document back to the app.
  const encodedPath = key.split("/").map(encodeURIComponent).join("/");
  const downloadUrl = `${storageUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`;
  const response = await fetch(downloadUrl, {
    headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` }
  });
  if (!response.ok) throw new Error(response.status === 404 ? "storage_object_missing" : `storage_download_failed_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function deletePrivateObject(key, bucket = storageBucket) {
  if (!persistentStorageReady) throw new Error("persistent_storage_not_configured");
  const response = await fetch(storageObjectUrl(key, bucket), { method: "DELETE", headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` } });
  if (!response.ok && response.status !== 404) throw new Error(`storage_delete_failed_${response.status}`);
}
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      // Vercel creates multiple serverless instances. Keep one DB socket per
      // instance to avoid exhausting Supabase's small session-pool connection cap.
      max: Math.max(1, Number(process.env.PG_POOL_MAX) || (process.env.VERCEL ? 1 : 5)),
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true
    })
  : null;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/v1/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }));
const smtpPort = Number(process.env.SMTP_PORT || 465);
const mailer = process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: smtpPort,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : smtpPort === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

if (mailer) {
  mailer.verify()
    .then(() => console.log("Service e-mail SMTP prêt."))
    .catch(error => console.error("Vérification SMTP échouée :", error.message));
}
// Supabase Auth sends confirmation messages through the project's configured email service.
const supabaseAuthUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseAuthKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
async function supabaseAuth(pathname, { method = "GET", token, body } = {}) {
  if (!supabaseAuthUrl || !supabaseAuthKey) throw new Error("supabase_auth_not_configured");
  const response = await fetch(`${supabaseAuthUrl}/auth/v1${pathname}`, {
    method,
    headers: {
      apikey: supabaseAuthKey,
      Authorization: `Bearer ${token || supabaseAuthKey}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const makeToken = () => randomBytes(32).toString("base64url");
const publicUser = (u) => ({
  id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email,
  role: u.effective_role || u.role, baseRole: u.role,
  universityId: u.university_id, facultyId: u.faculty_id,
  optionId: u.option_id, studyLevelId: u.study_level_id,
  universityName: u.university_name || "", facultyName: u.faculty_name || "",
  optionName: u.option_name || "", studyLevelLabel: u.study_level_label || "",
  workspaces: (() => {
    const assignments = Array.isArray(u.workspaces) ? u.workspaces : [];
    const base = ["student","delegate","professor","admin"].includes(u.role) ? [{ role: u.role, base: true }] : [];
    return [...assignments, ...base.filter(item => !assignments.some(workspace => workspace.role === item.role))];
  })(),
  roleApplications: Array.isArray(u.role_applications) ? u.role_applications : []
});
async function getPublicUser(user) {
  const result = await pool.query(
    `SELECT u.*, un.name AS university_name, f.name AS faculty_name,
            o.name AS option_name, l.label AS study_level_label,
            CASE WHEN u.role='admin' THEN 'admin' ELSE COALESCE(ra.role,u.role) END AS effective_role,
            COALESCE((SELECT json_agg(json_build_object(
              'assignmentId',a.id,'role',a.role,'universityId',a.university_id,
              'facultyId',a.faculty_id,'optionId',a.option_id,'studyLevelId',a.study_level_id,
              'universityName',au.name,'facultyName',af.name,'optionName',ao.name,'studyLevelLabel',al.label
            ) ORDER BY CASE a.role WHEN 'admin_general' THEN 1 WHEN 'university_admin' THEN 2
              WHEN 'faculty_manager' THEN 3 WHEN 'program_manager' THEN 4 WHEN 'professor' THEN 5 ELSE 9 END,a.id)
             FROM role_assignments a
             LEFT JOIN universities au ON au.id=a.university_id
             LEFT JOIN faculties af ON af.id=a.faculty_id
             LEFT JOIN options ao ON ao.id=a.option_id
             LEFT JOIN study_levels al ON al.id=a.study_level_id
             WHERE a.user_id=u.id AND a.status='active'),'[]'::json) AS workspaces,
            COALESCE((
              SELECT json_agg(application.item ORDER BY application.created_at DESC)
              FROM (
                SELECT json_build_object(
                  'assignmentId',a.id,'role',a.role,'status',a.status,
                  'universityId',a.university_id,'facultyId',a.faculty_id,
                  'optionId',a.option_id,'studyLevelId',a.study_level_id,
                  'universityName',au.name,'facultyName',af.name,
                  'optionName',ao.name,'studyLevelLabel',al.label
                ) AS item,a.created_at
                FROM role_assignments a
                LEFT JOIN universities au ON au.id=a.university_id
                LEFT JOIN faculties af ON af.id=a.faculty_id
                LEFT JOIN options ao ON ao.id=a.option_id
                LEFT JOIN study_levels al ON al.id=a.study_level_id
                WHERE a.user_id=u.id AND a.role<>'professor' AND a.status IN ('pending','revoked')
                UNION ALL
                SELECT json_build_object(
                  'assignmentId',pa.id,'role','professor',
                  'status',CASE pa.approval_status WHEN 'pending' THEN 'pending' ELSE 'revoked' END,
                  'universityId',pa.university_id,'facultyId',pa.faculty_id,
                  'optionId',pa.option_id,'studyLevelId',pa.study_level_id,
                  'universityName',pu.name,'facultyName',pf.name,
                  'optionName',po.name,'studyLevelLabel',pl.label,
                  'courseId',pa.requested_course_id,'courseName',pc.name
                ) AS item,pa.created_at
                FROM professor_assignments pa
                JOIN professor_invites pi ON pi.id=pa.invite_id
                JOIN universities pu ON pu.id=pa.university_id
                JOIN faculties pf ON pf.id=pa.faculty_id
                JOIN options po ON po.id=pa.option_id
                JOIN study_levels pl ON pl.id=pa.study_level_id
                LEFT JOIN courses pc ON pc.id=pa.requested_course_id
                WHERE pi.user_id=u.id AND pa.approval_status IN ('pending','rejected')
              ) application
            ),'[]'::json) AS role_applications
     FROM users u
     LEFT JOIN universities un ON un.id=u.university_id
     LEFT JOIN faculties f ON f.id=u.faculty_id
     LEFT JOIN options o ON o.id=u.option_id
     LEFT JOIN study_levels l ON l.id=u.study_level_id
     LEFT JOIN LATERAL (
       SELECT role FROM role_assignments
       WHERE user_id=u.id AND status='active'
       ORDER BY CASE role WHEN 'admin_general' THEN 1 WHEN 'university_admin' THEN 2
         WHEN 'faculty_manager' THEN 3 WHEN 'program_manager' THEN 4 WHEN 'professor' THEN 5 ELSE 9 END
       LIMIT 1
     ) ra ON TRUE
     WHERE u.id=$1 LIMIT 1`,
    [user.id]
  );
  return publicUser(result.rows[0] || user);
}
async function requireAuth(req, res, next) {
  if (!pool) return res.status(503).json({ error: "service_unavailable" });
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.get("authorization") || "");
  if (!match) return res.status(401).json({ error: "authentication_required" });
  try {
    const result = await pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
       AND u.is_active=TRUE`,
      [hashToken(match[1])]
    );
    if (!result.rowCount) return res.status(401).json({ error: "invalid_or_expired_session" });
    const assignments = await pool.query(
      "SELECT id,role,university_id,faculty_id,option_id,study_level_id FROM role_assignments WHERE user_id=$1 AND status='active'",
      [result.rows[0].id]
    );
    req.user = result.rows[0];
    req.roleAssignments = assignments.rows;
    req.activeRoles = assignments.rows.map(assignment => assignment.role);
    next();
  } catch {
    return res.status(503).json({ error: "service_unavailable" });
  }
}
const requireAdmin = requireGeneralAdmin;

app.use("/api/v1", createClassDocumentsRouter({
  pool, requireAuth, requireAdmin, storePrivateObject, readPrivateObject, deletePrivateObject
}));
app.use("/api/v1", createRoleRegistrationRouter({ pool }));
app.use("/api/v1", createProfessorsRouter({ pool, requireAuth, requireAdmin }));
app.use("/api/v1", createProgramManagerRouter({ pool, requireAuth, readPrivateObject }));
app.use("/api/v1", createFacultyManagerRouter({ pool, requireAuth, readPrivateObject }));
app.use("/api/v1", createUniversityAdminRouter({ pool, requireAuth }));
app.use("/api/v1", createUniversityCatalogRouter({ pool, requireAuth }));
app.use("/api/v1", createGeneralAdminRouter({ pool, requireAuth }));

app.get("/api/health", async (_req, res) => {
  if (!pool) {
    return res.status(503).json({ status: "not_ready", service: "ifacuniversite-api", reason: "database_not_configured" });
  }
  try {
    await pool.query("SELECT 1");
    return res.json({ status: "ok", service: "ifacuniversite-api", database: "connected" });
  } catch {
    return res.status(503).json({ status: "not_ready", service: "ifacuniversite-api", reason: "database_unavailable" });
  }
});

app.get("/api/info", (_req, res) => {
  res.json({
    name: "iFac universite",
    stage: "prototype",
    databaseConfigured: Boolean(pool),
    message: "Le catalogue et les services étudiants nécessitent une base configurée et des données validées."
  });
});

function requireDatabase(_req, res, next) {
  if (!pool) return res.status(503).json({ error: "service_unavailable", message: "La base de données n’est pas configurée." });
  next();
}

app.get("/api/v1/catalog/universities", requireDatabase, async (_req, res) => {
  try {
    const result = await listRegistrableUniversities(pool);
    res.set("Cache-Control", "no-store");
    return res.json({ data: result.rows });
  } catch {
    return res.status(503).json({ error: "catalog_unavailable", message: "Le catalogue est temporairement indisponible." });
  }
});

app.get("/api/v1/catalog/faculties", requireDatabase, async (req, res) => {
  const universityId = Number(req.query.universityId);
  if (!Number.isSafeInteger(universityId) || universityId < 1) {
    return res.status(400).json({ error: "invalid_university_id" });
  }
  try {
    const result = await pool.query(
      "SELECT f.id, f.code, f.name FROM faculties f JOIN universities u ON u.id = f.university_id WHERE f.university_id = $1 AND f.is_active = TRUE AND u.is_active = TRUE ORDER BY f.name",
      [universityId]
    );
    res.set("Cache-Control", "no-store");
    return res.json({ data: result.rows });
  } catch {
    return res.status(503).json({ error: "catalog_unavailable", message: "Le catalogue est temporairement indisponible." });
  }
});

app.get("/api/v1/catalog/options", requireDatabase, async (req, res) => {
  const facultyId = Number(req.query.facultyId);
  if (!Number.isSafeInteger(facultyId) || facultyId < 1) {
    return res.status(400).json({ error: "invalid_faculty_id" });
  }
  try {
    const result = await pool.query(
      "SELECT o.id, o.code, o.name FROM options o JOIN faculties f ON f.id = o.faculty_id JOIN universities u ON u.id = f.university_id WHERE o.faculty_id = $1 AND o.is_active = TRUE AND f.is_active = TRUE AND u.is_active = TRUE ORDER BY o.name",
      [facultyId]
    );
    res.set("Cache-Control", "no-store");
    return res.json({ data: result.rows });
  } catch {
    return res.status(503).json({ error: "catalog_unavailable", message: "Le catalogue est temporairement indisponible." });
  }
});

app.get("/api/v1/catalog/levels", requireDatabase, async (req, res) => {
  const optionId = Number(req.query.optionId);
  if (!Number.isSafeInteger(optionId) || optionId < 1) {
    return res.status(400).json({ error: "invalid_option_id" });
  }
  try {
    const result = await pool.query(
      "SELECT l.id, l.code, l.label, l.sort_order FROM study_levels l JOIN options o ON o.id = l.option_id JOIN faculties f ON f.id = o.faculty_id JOIN universities u ON u.id = f.university_id WHERE l.option_id = $1 AND l.is_active = TRUE AND o.is_active = TRUE AND f.is_active = TRUE AND u.is_active = TRUE ORDER BY l.sort_order",
      [optionId]
    );
    res.set("Cache-Control", "no-store");
    return res.json({ data: result.rows });
  } catch {
    return res.status(503).json({ error: "catalog_unavailable", message: "Le catalogue est temporairement indisponible." });
  }
});


app.post("/api/v1/auth/register", requireDatabase, async (req, res) => {
  const { firstName, lastName, email, password, universityCode, facultyCode, optionCode, studyLevelCode } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (![firstName, lastName].every(v => typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 100) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254 ||
      typeof password !== "string" || password.length < 10 || password.length > 128 ||
      ![universityCode, facultyCode, optionCode, studyLevelCode].every(v => typeof v === "string" && /^[A-Z0-9_]{2,64}$/.test(v))) {
    return res.status(400).json({ error: "invalid_registration", message: "Vérifiez les champs et utilisez un mot de passe de 10 caractères minimum." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profile = await findActiveAcademicProfile(client, {
      universityCode, facultyCode, optionCode, studyLevelCode
    });
    if (!profile.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_academic_profile", message: "Le parcours universitaire sélectionné n’est pas valide." });
    }
    const existing = await client.query("SELECT id FROM users WHERE email=$1", [normalizedEmail]);
    if (existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "email_already_registered", message: "Cette adresse e-mail est déjà associée à un compte." });
    }

    const verificationUrl = new URL("/verify-email", process.env.APP_BASE_URL || "http://localhost:3435");
    const signup = await supabaseAuth(`/signup?redirect_to=${encodeURIComponent(verificationUrl.toString())}`, {
      method: "POST",
      body: { email: normalizedEmail, password, data: { first_name: firstName.trim(), last_name: lastName.trim() } }
    });
    if (!signup.response.ok) {
      await client.query("ROLLBACK");
      const details = String(signup.data?.code || signup.data?.error_code || signup.data?.msg || signup.data?.message || signup.data?.error_description || "");
      if (signup.response.status === 429) return res.status(429).json({ error: "email_rate_limited", message: "Supabase limite temporairement les e-mails de confirmation. Réessayez plus tard." });
      if (/email_address_not_authorized/i.test(details)) {
        return res.status(403).json({ error: "email_address_not_authorized", message: "L’e-mail intégré de Supabase est limité aux membres de l’équipe du projet. Pour recevoir les confirmations de tous les étudiants, un service d’e-mail devra être configuré." });
      }
      if (/already registered|already been registered|user already exists|email_exists/i.test(details)) {
        return res.status(409).json({ error: "email_already_registered", message: "Cette adresse e-mail possède déjà un compte d’authentification." });
      }
      console.error("Échec Supabase Auth à l’inscription:", { status: signup.response.status, details });
      return res.status(503).json({ error: "registration_unavailable", message: "Supabase n’a pas pu créer le compte ou envoyer le message de confirmation. Vérifiez les paramètres Auth." });
    }

    // Supabase Auth stores and verifies the real password. This legacy column receives
    // an unusable random hash so no duplicate usable password is stored by iFac.
    const passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
    const authUserId = signup.data?.user?.id;
    if (typeof authUserId !== "string") {
      await client.query("ROLLBACK");
      return res.status(503).json({ error: "auth_identity_unavailable", message: "Supabase n’a pas retourné l’identifiant sécurisé du compte." });
    }
    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const role = adminEmail && normalizedEmail === adminEmail ? "admin" : "student";
    const createdUser = await client.query(
      `INSERT INTO users (auth_user_id,university_id,faculty_id,option_id,study_level_id,first_name,last_name,email,password_hash,role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,university_id,faculty_id,option_id,study_level_id,role`,
      [authUserId,profile.rows[0].university_id,profile.rows[0].faculty_id,profile.rows[0].option_id,profile.rows[0].study_level_id,firstName.trim(),lastName.trim(),normalizedEmail,passwordHash,role]
    );
    await client.query("COMMIT");
    return res.status(201).json({ message: "Compte créé. Consultez votre boîte e-mail pour confirmer votre adresse avant de vous connecter." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Échec inscription iFac:", {
      code: error?.code || "unknown",
      message: error?.message || "Erreur inconnue",
      detail: error?.detail || null,
      constraint: error?.constraint || null
    });
    if (error?.code === "23505") return res.status(409).json({ error: "email_already_registered" });
    return res.status(503).json({ error: "registration_unavailable" });
  } finally {
    client.release();
  }
});

app.post("/api/v1/auth/verify-email", requireDatabase, async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return res.status(400).json({ error: "invalid_token" });
  try {
    const verified = await supabaseAuth("/user", { token });
    const email = typeof verified.data?.email === "string" ? verified.data.email.trim().toLowerCase() : "";
    if (verified.response.ok && email && (verified.data.email_confirmed_at || verified.data.confirmed_at)) {
      const updated = await pool.query(
        "UPDATE users SET email_verified_at=COALESCE(email_verified_at,NOW()),updated_at=NOW() WHERE email=$1 RETURNING id",
        [email]
      );
      if (!updated.rowCount) return res.status(404).json({ error: "profile_not_found", message: "L’adresse est confirmée, mais le profil étudiant est introuvable. Contactez l’administrateur." });
      return res.json({ message: "Adresse e-mail confirmée. Vous pouvez vous connecter." });
    }

    // Accept one-time links generated by the previous version during transition.
    const legacy = await pool.query(
      `UPDATE users SET email_verified_at=NOW(), updated_at=NOW()
       WHERE id=(SELECT user_id FROM email_tokens WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at>NOW())
       RETURNING id`,
      [hashToken(token)]
    );
    if (!legacy.rowCount) return res.status(400).json({ error: "invalid_or_expired_token", message: "Le lien de confirmation est invalide ou expiré." });
    await pool.query("UPDATE email_tokens SET used_at=NOW() WHERE token_hash=$1", [hashToken(token)]);
    return res.json({ message: "Adresse e-mail confirmée. Vous pouvez vous connecter." });
  } catch (error) {
    console.error("Échec confirmation e-mail:", error?.message || "unknown");
    return res.status(503).json({ error: "verification_unavailable", message: "Impossible de vérifier le lien pour le moment." });
  }
});

app.post("/api/v1/auth/password-reset/request", requireDatabase, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const generic = { message: "Si cette adresse correspond à un compte actif, un lien de récupération sera envoyé." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.json(generic);
  if (!mailer) return res.status(503).json({ error: "email_service_not_configured" });
  try {
    const found = await pool.query("SELECT id FROM users WHERE email=$1 AND is_active=TRUE AND email_verified_at IS NOT NULL", [email]);
    if (found.rowCount) {
      const token = makeToken();
      await pool.query("INSERT INTO email_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'reset_password',NOW()+INTERVAL '30 minutes')", [found.rows[0].id,hashToken(token)]);
      const url = new URL("/reset-password", process.env.APP_BASE_URL || "http://localhost:3435");
      url.searchParams.set("token",token);
      await mailer.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Réinitialisation du mot de passe — iFac universite",
        text: `Pour choisir un nouveau mot de passe, ouvrez ce lien dans les 30 minutes : ${url.toString()}`
      });
    }
    return res.json(generic);
  } catch { return res.status(503).json({ error: "password_reset_unavailable" }); }
});

app.post("/api/v1/auth/password-reset/confirm", requireDatabase, async (req, res) => {
  const token = req.body?.token, password = req.body?.password;
  if (typeof token !== "string" || token.length < 20 || token.length > 200 || typeof password !== "string" || password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "invalid_reset_request", message: "Le lien doit être valide et le nouveau mot de passe contenir au moins 10 caractères." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const match = await client.query(
      "SELECT t.user_id,u.auth_user_id FROM email_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.purpose='reset_password' AND t.used_at IS NULL AND t.expires_at>NOW() FOR UPDATE OF t,u",
      [hashToken(token)]
    );
    if (!match.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }
    const userId = match.rows[0].user_id;
    const authUserId = await resolveAuthUserId(client, userId, match.rows[0].auth_user_id);
    let passwordHash;
    if (authUserId) {
      const authUpdate = await updateSupabaseUserPassword({
        supabaseUrl: supabaseAuthUrl,
        secretKey: storageKey,
        userId: authUserId,
        password
      });
      if (!authUpdate.ok) {
        await client.query("ROLLBACK");
        return res.status(503).json({ error: "supabase_password_update_failed", message: "Supabase Auth n’a pas accepté le changement. Le lien reste valable ; réessayez plus tard." });
      }
      // Keep the local legacy hash unusable; Supabase Auth remains the password authority.
      passwordHash = await bcrypt.hash(randomBytes(48).toString("hex"),12);
    } else {
      // Accounts predating Supabase Auth continue to use the legacy password verifier.
      passwordHash = await bcrypt.hash(password,12);
    }
    await client.query("UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2", [passwordHash,userId]);
    await client.query("UPDATE email_tokens SET used_at=NOW() WHERE user_id=$1 AND purpose='reset_password' AND used_at IS NULL", [userId]);
    await client.query("UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", [userId]);
    await client.query("COMMIT");
    return res.json({ message: "Mot de passe modifié. Connectez-vous avec le nouveau mot de passe." });
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(503).json({ error: "password_reset_unavailable" });
  } finally { client.release(); }
});

app.post("/api/v1/auth/login", requireDatabase, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;
  if (!email || typeof password !== "string" || password.length > 128) return res.status(400).json({ error: "invalid_credentials" });
  try {
    let user = null;
    let authError = "";
    try {
      const auth = await supabaseAuth("/token?grant_type=password", { method: "POST", body: { email, password } });
      if (auth.response.ok && auth.data?.access_token) {
        const authUserId = typeof auth.data?.user?.id === "string" ? auth.data.user.id : null;
        const result = await pool.query(
          "UPDATE users SET auth_user_id=COALESCE(auth_user_id,$2::uuid),email_verified_at=COALESCE(email_verified_at,NOW()),updated_at=NOW() WHERE lower(email)=lower($1) AND is_active=TRUE AND ($2::uuid IS NULL OR auth_user_id IS NULL OR auth_user_id=$2::uuid) RETURNING *",
          [email,authUserId]
        );
        user = result.rows[0] || null;
      } else {
        authError = String(auth.data?.code || auth.data?.error_code || auth.data?.msg || auth.data?.message || "");
      }
    } catch (error) {
      console.error("Supabase Auth login indisponible:", error?.message || "unknown");
    }

    // Preserve login for verified accounts created before this authentication transition.
    if (!user) {
      const legacy = await pool.query("SELECT * FROM users WHERE email=$1 AND is_active=TRUE", [email]);
      const candidate = legacy.rows[0];
      if (candidate && candidate.email_verified_at && await bcrypt.compare(password, candidate.password_hash)) user = candidate;
    }

    if (!user) {
      if (/email_not_confirmed|email not confirmed/i.test(authError)) {
        return res.status(403).json({ error: "email_not_verified", message: "Confirmez votre adresse e-mail à partir du lien reçu avant de vous connecter." });
      }
      return res.status(401).json({ error: "invalid_credentials", message: "Adresse e-mail ou mot de passe incorrect." });
    }
    if (!user.email_verified_at) return res.status(403).json({ error: "email_not_verified", message: "Confirmez votre adresse e-mail avant de vous connecter." });
    const token = makeToken();
    await pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,NOW()+INTERVAL '7 days')", [user.id, hashToken(token)]);
    res.set("Cache-Control", "no-store");
    return res.json({ token, expiresIn: 604800, user: await getPublicUser(user) });
  } catch (error) {
    console.error("Échec connexion iFac:", error?.message || "unknown");
    return res.status(503).json({ error: "login_unavailable", message: "Le service de connexion est temporairement indisponible." });
  }
});

app.post("/api/v1/auth/logout", requireAuth, async (req, res) => {
  const token = req.get("authorization").slice(7);
  try {
    await pool.query("UPDATE sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL", [hashToken(token)]);
    return res.status(204).end();
  } catch { return res.status(503).json({ error: "logout_unavailable" }); }
});
app.get("/api/v1/auth/me", requireAuth, async (req, res) => {
  try { res.set("Cache-Control", "no-store"); return res.json({ user: await getPublicUser(req.user) }); }
  catch { return res.status(503).json({ error: "profile_unavailable", message: "Impossible de charger les informations du profil." }); }
});

app.get("/api/v1/notes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT id,title,body,created_at,updated_at FROM personal_notes WHERE user_id=$1 ORDER BY updated_at DESC", [req.user.id]);
    return res.json({ data: result.rows });
  } catch { return res.status(503).json({ error: "notes_unavailable" }); }
});
app.post("/api/v1/notes", requireAuth, async (req, res) => {
  const { title, body = "" } = req.body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 180 || typeof body !== "string" || body.length > 50000) return res.status(400).json({ error: "invalid_note" });
  try {
    const result = await pool.query("INSERT INTO personal_notes(user_id,title,body) VALUES($1,$2,$3) RETURNING id,title,body,created_at,updated_at", [req.user.id,title.trim(),body]);
    return res.status(201).json({ note: result.rows[0] });
  } catch { return res.status(503).json({ error: "note_save_failed" }); }
});
app.patch("/api/v1/notes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id), { title, body } = req.body || {};
  if (!Number.isSafeInteger(id) || id < 1 || typeof title !== "string" || !title.trim() || title.length > 180 || typeof body !== "string" || body.length > 50000) return res.status(400).json({ error: "invalid_note" });
  try {
    const result = await pool.query("UPDATE personal_notes SET title=$1,body=$2,updated_at=NOW() WHERE id=$3 AND user_id=$4 RETURNING id,title,body,created_at,updated_at", [title.trim(),body,id,req.user.id]);
    return result.rowCount ? res.json({ note: result.rows[0] }) : res.status(404).json({ error: "note_not_found" });
  } catch { return res.status(503).json({ error: "note_update_failed" }); }
});
app.delete("/api/v1/notes/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_note_id" });
  try {
    const result = await pool.query("DELETE FROM personal_notes WHERE id=$1 AND user_id=$2", [id,req.user.id]);
    return result.rowCount ? res.status(204).end() : res.status(404).json({ error: "note_not_found" });
  } catch { return res.status(503).json({ error: "note_delete_failed" }); }
});

app.get("/api/v1/announcements", requireAuth, async (req, res) => {
  try {
    await ensureAnnouncementImageColumns();
    const result = await pool.query(
      `SELECT id,title,body,starts_at,ends_at,created_at,(image_key IS NOT NULL) AS has_image FROM announcements
       WHERE university_id=$1 AND is_active=TRUE AND (starts_at IS NULL OR starts_at<=NOW())
       AND (ends_at IS NULL OR ends_at>NOW())
       AND (faculty_id IS NULL OR faculty_id=$2) AND (option_id IS NULL OR option_id=$3)
       AND (study_level_id IS NULL OR study_level_id=$4) ORDER BY created_at DESC LIMIT 100`,
      [req.user.university_id,req.user.faculty_id,req.user.option_id,req.user.study_level_id]
    );
    return res.json({ data: result.rows });
  } catch { return res.status(503).json({ error: "announcements_unavailable" }); }
});


const allowedDocumentTypes = new Set(["application/pdf"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, allowedDocumentTypes.has(file.mimetype))
});
const allowedAnnouncementImages = new Set(["image/jpeg","image/png","image/webp"]);
function isValidAnnouncementImage(buffer, mimeType) {
  if (!buffer || !allowedAnnouncementImages.has(mimeType)) return false;
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return buffer.subarray(0,4).toString() === "RIFF" && buffer.subarray(8,12).toString() === "WEBP";
}
function isAnnouncementOwner(req) { const ownerEmail=(process.env.IFAC_OWNER_EMAIL || "").trim().toLowerCase(); return Boolean(ownerEmail && req.user?.email?.toLowerCase() === ownerEmail); }
let announcementImageColumnsReady;
async function ensureAnnouncementImageColumns() {
  if (!announcementImageColumnsReady) announcementImageColumnsReady = pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_key TEXT, ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(80)").catch(error => { announcementImageColumnsReady = null; throw error; });
  await announcementImageColumnsReady;
}


app.get("/api/v1/admin/catalog", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [faculties, options, levels] = await Promise.all([
      pool.query("SELECT id,code,name FROM faculties WHERE university_id=$1 AND is_active=TRUE ORDER BY name", [req.user.university_id]),
      pool.query("SELECT o.id,o.code,o.name,o.faculty_id FROM options o JOIN faculties f ON f.id=o.faculty_id WHERE f.university_id=$1 AND f.is_active=TRUE AND o.is_active=TRUE ORDER BY o.name", [req.user.university_id]),
      pool.query("SELECT l.id,l.code,l.label,l.option_id,l.sort_order FROM study_levels l JOIN options o ON o.id=l.option_id JOIN faculties f ON f.id=o.faculty_id WHERE f.university_id=$1 AND f.is_active=TRUE AND o.is_active=TRUE AND l.is_active=TRUE ORDER BY l.sort_order", [req.user.university_id])
    ]);
    return res.json({ data: { faculties: faculties.rows, options: options.rows, levels: levels.rows } });
  } catch { return res.status(503).json({ error: "admin_catalog_unavailable" }); }
});

app.get("/api/v1/admin/subjects", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id,s.name,o.name AS option_name,l.label AS level_label
       FROM subjects s JOIN options o ON o.id=s.option_id
       JOIN faculties f ON f.id=o.faculty_id
       JOIN study_levels l ON l.id=s.study_level_id
       WHERE f.university_id=$1 AND s.is_active=TRUE
       ORDER BY o.name,l.sort_order,s.name`,
      [req.user.university_id]
    );
    return res.json({ data: result.rows });
  } catch { return res.status(503).json({ error: "subjects_unavailable" }); }
});
app.post("/api/v1/admin/documents", requireAuth, requireAdmin, upload.single("file"), async (req, res) => {
  const subjectId = Number(req.body?.subjectId);
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!req.file) return res.status(400).json({ error: "file_required", message: "Joignez un fichier PDF valide de 15 Mo maximum." });
  if (!Number.isSafeInteger(subjectId) || subjectId < 1 || !title || title.length > 220) return res.status(400).json({ error: "invalid_document_metadata" });
  if (!persistentStorageReady) return res.status(503).json({ error: "persistent_storage_not_configured", message: "Le stockage privé des documents doit être configuré avant les téléversements." });
  if (!allowedDocumentTypes.has(req.file.mimetype) || req.file.buffer.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "unsupported_file_type", message: "Le fichier doit être un vrai PDF." });
  const fileKey = `${randomUUID()}.pdf`;
  try {
    const subject = await pool.query(`SELECT s.id FROM subjects s JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id WHERE s.id=$1 AND s.is_active=TRUE AND o.is_active=TRUE AND f.university_id=$2`, [subjectId, req.user.university_id]);
    if (!subject.rowCount) return res.status(400).json({ error: "invalid_subject" });
    await storePrivateObject(fileKey, req.file.buffer, "application/pdf");
    try {
      const result = await pool.query(`INSERT INTO documents(subject_id,title,file_key,mime_type,file_size_bytes,uploaded_by,is_active) VALUES($1,$2,$3,$4,$5,$6,TRUE) RETURNING id,title,mime_type,file_size_bytes,created_at`, [subjectId,title,fileKey,"application/pdf",req.file.size,req.user.id]);
      return res.status(201).json({ document: result.rows[0] });
    } catch (error) { await deletePrivateObject(fileKey).catch(() => {}); throw error; }
  } catch (error) {
    console.error("Téléversement document échoué:", error.message);
    return res.status(503).json({ error: "document_upload_failed", message: "Le document n'a pas pu être enregistré." });
  }
});
app.get("/api/v1/documents/:id/download", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_document_id" });
  try {
    const result = await pool.query(`SELECT d.title,d.file_key,d.mime_type,d.file_size_bytes FROM documents d JOIN subjects s ON s.id=d.subject_id WHERE d.id=$1 AND d.is_active=TRUE AND d.status='approved' AND s.is_active=TRUE AND s.option_id=$2 AND s.study_level_id=$3`, [id,req.user.option_id,req.user.study_level_id]);
    if (!result.rowCount) return res.status(404).json({ error: "document_not_found" });
    const file = await readPrivateObject(result.rows[0].file_key);
    res.set("Content-Type", result.rows[0].mime_type);
    res.set("Content-Length", String(file.length));
    res.set("Content-Disposition", `inline; filename="ifac-document-${id}.pdf"`);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, no-store");
    return res.send(file);
  } catch (error) {
    if (error.message === "storage_object_missing") return res.status(404).json({ error: "document_file_missing" });
    if (error.message === "persistent_storage_not_configured") return res.status(503).json({ error: "persistent_storage_not_configured" });
    return res.status(503).json({ error: "document_download_failed" });
  }
});

app.get("/api/v1/admin/documents", requireAuth, requireAdmin, async (req,res) => {
  try {
    const result = await pool.query(`SELECT d.id,d.title,d.subject_id,d.mime_type,d.file_size_bytes,d.created_at,s.name AS subject,s.option_id,s.study_level_id FROM documents d JOIN subjects s ON s.id=d.subject_id JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id WHERE f.university_id=$1 AND d.is_active=TRUE ORDER BY d.created_at DESC LIMIT 500`,[req.user.university_id]);
    return res.json({data:result.rows});
  } catch { return res.status(503).json({error:"admin_documents_unavailable"}); }
});
app.patch("/api/v1/admin/documents/:id", requireAuth, requireAdmin, async (req,res) => {
  const id=Number(req.params.id), title=typeof req.body?.title==="string"?req.body.title.trim():"", subjectId=Number(req.body?.subjectId);
  if(!Number.isSafeInteger(id)||id<1||!title||title.length>220||!Number.isSafeInteger(subjectId)||subjectId<1) return res.status(400).json({error:"invalid_document_update"});
  try {
    const result=await pool.query(`UPDATE documents d SET title=$1,subject_id=$2,updated_at=NOW() FROM subjects s JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id JOIN subjects old_s ON old_s.id=d.subject_id JOIN options old_o ON old_o.id=old_s.option_id JOIN faculties old_f ON old_f.id=old_o.faculty_id WHERE d.id=$3 AND d.is_active=TRUE AND s.id=$2 AND s.is_active=TRUE AND f.university_id=$4 AND old_f.university_id=$4 RETURNING d.id,d.title,d.subject_id`,[title,subjectId,id,req.user.university_id]);
    return result.rowCount?res.json({document:result.rows[0]}):res.status(404).json({error:"document_not_found_or_invalid_subject"});
  } catch { return res.status(503).json({error:"document_update_failed"}); }
});
app.get("/api/v1/documents", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id,d.title,d.mime_type,d.file_size_bytes,d.created_at,s.name AS subject
       FROM documents d JOIN subjects s ON s.id=d.subject_id
       WHERE d.is_active=TRUE AND d.status='approved' AND s.is_active=TRUE AND s.option_id=$1 AND s.study_level_id=$2
       ORDER BY s.name,d.title LIMIT 300`,
      [req.user.option_id,req.user.study_level_id]
    );
    return res.json({ data: result.rows });
  } catch { return res.status(503).json({ error: "documents_unavailable" }); }
});


app.get("/api/v1/messages/groups", requireAuth, async (req, res) => {
  try {
    if (["student","delegate"].includes(req.user.role)) {
      await pool.query(
        `INSERT INTO group_members(group_id,user_id)
         SELECT g.id,$1 FROM message_groups g
         WHERE g.is_active=TRUE AND g.university_id=$2
           AND (g.faculty_id IS NULL OR g.faculty_id=$3)
           AND (g.option_id IS NULL OR g.option_id=$4)
           AND (g.study_level_id IS NULL OR g.study_level_id=$5) AND $6 IN ('student','delegate') AND EXISTS (SELECT 1 FROM users u WHERE u.id=$1 AND u.email_verified_at IS NOT NULL)
         ON CONFLICT DO NOTHING`,
        [req.user.id,req.user.university_id,req.user.faculty_id,req.user.option_id,req.user.study_level_id,req.user.role]
      );
    }
    const result = await pool.query(
      `SELECT g.id,g.group_type,g.faculty_id,g.option_id,g.study_level_id,
        f.name AS faculty_name,o.name AS option_name,l.label AS study_level_label
       FROM message_groups g JOIN group_members gm ON gm.group_id=g.id
       LEFT JOIN faculties f ON f.id=g.faculty_id
       LEFT JOIN options o ON o.id=g.option_id
       LEFT JOIN study_levels l ON l.id=g.study_level_id
       WHERE gm.user_id=$1 AND g.is_active=TRUE ORDER BY g.id`,
      [req.user.id]
    );
    return res.json({ data: result.rows });
  } catch { return res.status(503).json({ error: "groups_unavailable" }); }
});
app.get("/api/v1/messages/groups/:id", requireAuth, async (req, res) => {
  const groupId = Number(req.params.id);
  if (!Number.isSafeInteger(groupId) || groupId < 1) return res.status(400).json({ error: "invalid_group_id" });
  try {
    const member = await pool.query("SELECT 1 FROM group_members gm JOIN message_groups g ON g.id=gm.group_id WHERE gm.group_id=$1 AND gm.user_id=$2 AND g.is_active=TRUE", [groupId,req.user.id]);
    if (!member.rowCount) return res.status(404).json({ error: "group_not_found" });
    const result = await pool.query(
      `SELECT m.id,m.body,m.created_at,u.first_name,u.last_name FROM messages m
       JOIN users u ON u.id=m.sender_id WHERE m.group_id=$1 AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC LIMIT 100`, [groupId]
    );
    return res.json({ data: result.rows.reverse() });
  } catch { return res.status(503).json({ error: "messages_unavailable" }); }
});
app.get("/api/v1/admin/messages", requireAuth, requireAdmin, async (req,res) => {
  try {
    const result=await pool.query(`SELECT m.id,m.body,m.created_at,u.first_name,u.last_name,g.id AS group_id,g.group_type FROM messages m JOIN message_groups g ON g.id=m.group_id JOIN users u ON u.id=m.sender_id WHERE g.university_id=$1 AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 500`,[req.user.university_id]);
    return res.json({data:result.rows});
  } catch { return res.status(503).json({error:"admin_messages_unavailable"}); }
});
app.patch("/api/v1/admin/messages/:id", requireAuth, requireAdmin, async (req,res) => {
  const id=Number(req.params.id), body=typeof req.body?.body==="string"?req.body.body.trim():"";
  if(!Number.isSafeInteger(id)||id<1||!body||body.length>5000) return res.status(400).json({error:"invalid_message"});
  try {
    const result=await pool.query("UPDATE messages m SET body=$1 FROM message_groups g WHERE m.group_id=g.id AND m.id=$2 AND g.university_id=$3 AND m.deleted_at IS NULL RETURNING m.id,m.body", [body,id,req.user.university_id]);
    return result.rowCount?res.json({message:result.rows[0]}):res.status(404).json({error:"message_not_found"});
  } catch { return res.status(503).json({error:"message_update_failed"}); }
});
app.delete("/api/v1/admin/messages/:id", requireAuth, requireAdmin, async (req,res) => {
  const id=Number(req.params.id); if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:"invalid_message_id"});
  try {
    const result=await pool.query("UPDATE messages m SET deleted_at=NOW() FROM message_groups g WHERE m.group_id=g.id AND m.id=$1 AND g.university_id=$2 AND m.deleted_at IS NULL RETURNING m.id",[id,req.user.university_id]);
    return result.rowCount?res.status(204).end():res.status(404).json({error:"message_not_found"});
  } catch { return res.status(503).json({error:"message_delete_failed"}); }
});
app.post("/api/v1/messages/groups/:id", requireAuth, async (req, res) => {
  const groupId = Number(req.params.id), body = req.body?.body;
  if (!Number.isSafeInteger(groupId) || groupId < 1 || typeof body !== "string" || !body.trim() || body.trim().length > 5000) return res.status(400).json({ error: "invalid_message" });
  try {
    const member = await pool.query("SELECT 1 FROM group_members gm JOIN message_groups g ON g.id=gm.group_id WHERE gm.group_id=$1 AND gm.user_id=$2 AND g.is_active=TRUE", [groupId,req.user.id]);
    if (!member.rowCount) return res.status(404).json({ error: "group_not_found" });
    const result = await pool.query("INSERT INTO messages(group_id,sender_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at", [groupId,req.user.id,body.trim()]);
    return res.status(201).json({ message: result.rows[0] });
  } catch { return res.status(503).json({ error: "message_send_failed" }); }
});

app.get("/api/v1/admin/announcements", requireAuth, requireAdmin, async (req,res) => {
  try {
    await ensureAnnouncementImageColumns();
    const result=await pool.query("SELECT id,title,body,created_at,(image_key IS NOT NULL) AS has_image FROM announcements WHERE university_id=$1 ORDER BY created_at DESC LIMIT 200",[req.user.university_id]);
    return res.json({data:result.rows,canUploadFlyers:isAnnouncementOwner(req)});
  } catch { return res.status(503).json({error:"admin_announcements_unavailable"}); }
});
app.post("/api/v1/admin/announcements/upload-token", requireAuth, requireAdmin, async (req, res) => {
  if (!isAnnouncementOwner(req)) return res.status(403).json({ error: "flyer_owner_only", message: "Seul le compte principal iFac peut joindre un flyer." });
  const contentType = req.body?.contentType;
  const fileSize = Number(req.body?.fileSize);
  if (!allowedAnnouncementImages.has(contentType) || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 8 * 1024 * 1024) {
    return res.status(400).json({ error: "invalid_announcement_image", message: "Choisissez une image PNG, JPG ou WebP de 8 Mo maximum." });
  }
  if (!persistentStorageReady) return res.status(503).json({ error: "announcement_storage_unavailable", message: "Le stockage des images n’est pas configuré." });
  const imageKey = `announcements/${randomUUID()}`;
  try {
    const encodedPath = imageKey.split("/").map(encodeURIComponent).join("/");
    const signed = await fetch(`${storageUrl}/storage/v1/object/upload/sign/${encodeURIComponent(announcementStorageBucket)}/${encodedPath}`, {
      method: "POST",
      headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ upsert: false })
    });
    const signedData = await signed.json().catch(() => ({}));
    if (!signed.ok || !signedData.token) {
      console.error("Signature d’envoi d’image refusée:", signed.status, signedData.message || signedData.error || "");
      return res.status(503).json({ error: "announcement_upload_sign_failed", message: "Impossible de préparer le téléversement de l’image. Réessayez." });
    }
    const storageHost = new URL(storageUrl).hostname.replace(".supabase.co", ".storage.supabase.co");
    const uploadEndpoint = `${new URL(storageUrl).protocol}//${storageHost}/storage/v1/upload/resumable/sign`;
    return res.json({ imageKey, token: signedData.token, uploadEndpoint, bucket: announcementStorageBucket, publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "" });
  } catch (error) {
    console.error("Préparation du téléversement échouée:", error?.message);
    return res.status(503).json({ error: "announcement_upload_sign_failed", message: "Impossible de préparer le téléversement de l’image." });
  }
});

app.post("/api/v1/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!title || title.length > 220 || !body || body.length > 20000) return res.status(400).json({ error: "invalid_announcement" });
  const uploadedImageKey = typeof req.body?.imageKey === "string" ? req.body.imageKey : null;
  const imageMimeType = req.body?.imageMimeType || null;
  if (uploadedImageKey && !isAnnouncementOwner(req)) return res.status(403).json({ error: "flyer_owner_only", message: "Seul le compte principal iFac peut ajouter un flyer." });
  if (uploadedImageKey && (!uploadedImageKey.startsWith("announcements/") || uploadedImageKey.includes(".."))) return res.status(400).json({ error: "invalid_announcement_image", message: "Le fichier image transmis n’est pas valide." });
  if (uploadedImageKey && !allowedAnnouncementImages.has(imageMimeType)) return res.status(400).json({ error: "invalid_announcement_image", message: "Format refusé. Utilisez PNG, JPG ou WebP." });
  const imageKey = uploadedImageKey;
  try {
    await ensureAnnouncementImageColumns();
    if (uploadedImageKey) {
      const uploadedImage = await readPrivateObject(uploadedImageKey, announcementStorageBucket);
      if (!isValidAnnouncementImage(uploadedImage, imageMimeType)) {
        await deletePrivateObject(uploadedImageKey, announcementStorageBucket).catch(() => {});
        return res.status(400).json({ error: "invalid_announcement_image", message: "Le fichier transmis ne correspond pas à une image PNG, JPG ou WebP valide." });
      }
    }
    const result = await pool.query(
      `INSERT INTO announcements(university_id,faculty_id,option_id,study_level_id,title,body,is_active,starts_at,ends_at,created_by,image_key,image_mime_type)
       VALUES($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9,$10,$11) RETURNING id,title,body,is_active,starts_at,ends_at,created_at,image_mime_type`,
      [req.user.university_id,req.body.facultyId || null,req.body.optionId || null,req.body.studyLevelId || null,title,body,req.body.startsAt || null,req.body.endsAt || null,req.user.id,imageKey,imageMimeType]
    );
    return res.status(201).json({ announcement: result.rows[0] });
  } catch (error) {
    if (imageKey) await deletePrivateObject(imageKey, announcementStorageBucket).catch(() => {});
    console.error("Création annonce échouée:", error?.message);
    return res.status(503).json({ error: "announcement_create_failed", message: "La publication a échoué pendant l’enregistrement. Vérifiez votre connexion puis réessayez." });
  }
});
app.patch("/api/v1/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id), title = typeof req.body?.title === "string" ? req.body.title.trim() : "", body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!Number.isSafeInteger(id) || id < 1 || !title || title.length > 220 || !body || body.length > 20000) return res.status(400).json({ error: "invalid_announcement" });
  try {
    await ensureAnnouncementImageColumns();
    const old = await pool.query("SELECT id FROM announcements WHERE id=$1 AND university_id=$2", [id,req.user.university_id]);
    if (!old.rowCount) return res.status(404).json({ error: "announcement_not_found" });
    await pool.query("UPDATE announcements SET title=$1,body=$2 WHERE id=$3 AND university_id=$4", [title,body,id,req.user.university_id]);
    return res.json({ message: "Annonce modifiée." });
  } catch (error) { console.error("Modification annonce:",error?.message); return res.status(503).json({ error: "announcement_update_failed" }); }
});
app.delete("/api/v1/admin/announcements/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id); if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_announcement_id" });
  try {
    await ensureAnnouncementImageColumns();
    const found = await pool.query("DELETE FROM announcements WHERE id=$1 AND university_id=$2 RETURNING image_key", [id,req.user.university_id]);
    if (!found.rowCount) return res.status(404).json({ error: "announcement_not_found" });
    if (found.rows[0].image_key) await deletePrivateObject(found.rows[0].image_key,announcementStorageBucket).catch(() => {});
    return res.status(204).end();
  } catch { return res.status(503).json({ error: "announcement_delete_failed" }); }
});
app.get("/api/v1/announcements/:id/image", requireAuth, async (req, res) => {
  const id = Number(req.params.id); if (!Number.isSafeInteger(id) || id < 1) return res.status(400).end();
  try {
    await ensureAnnouncementImageColumns();
    const found = await pool.query("SELECT image_key,image_mime_type FROM announcements WHERE id=$1 AND university_id=$2 AND is_active=TRUE AND (starts_at IS NULL OR starts_at<=NOW()) AND (ends_at IS NULL OR ends_at>NOW()) AND (faculty_id IS NULL OR faculty_id=$3) AND (option_id IS NULL OR option_id=$4) AND (study_level_id IS NULL OR study_level_id=$5)", [id,req.user.university_id,req.user.faculty_id,req.user.option_id,req.user.study_level_id]);
    if (!found.rowCount || !found.rows[0].image_key) return res.status(404).end();
    const file = await readPrivateObject(found.rows[0].image_key,announcementStorageBucket);
    res.set("Content-Type",found.rows[0].image_mime_type || "application/octet-stream"); res.set("Cache-Control","private, no-store"); res.set("X-Content-Type-Options","nosniff");
    return res.send(file);
  } catch { return res.status(503).end(); }
});

app.post("/api/v1/feedback", requireAuth, async (req, res) => {
  const { category, message, rating = null } = req.body || {};
  if (!["suggestion","question","rating"].includes(category) || typeof message !== "string" || !message.trim() || message.trim().length > 5000 ||
      (rating !== null && (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5))) return res.status(400).json({ error: "invalid_feedback" });
  try {
    const result = await pool.query("INSERT INTO feedback(user_id,category,message,rating) VALUES($1,$2,$3,$4) RETURNING id,created_at", [req.user.id,category,message.trim(),rating === null ? null : Number(rating)]);
    return res.status(201).json({ feedback: result.rows[0], message: "Votre avis a été envoyé." });
  } catch { return res.status(503).json({ error: "feedback_unavailable" }); }
});

app.post("/api/v1/admin/subjects", requireAuth, requireAdmin, async (req, res) => {
  const optionId = Number(req.body?.optionId), studyLevelId = Number(req.body?.studyLevelId);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!Number.isSafeInteger(optionId) || optionId < 1 || !Number.isSafeInteger(studyLevelId) || studyLevelId < 1 || !name || name.length > 180) return res.status(400).json({ error: "invalid_subject" });
  try {
    const valid = await pool.query(`SELECT 1 FROM options o JOIN faculties f ON f.id=o.faculty_id JOIN study_levels l ON l.option_id=o.id WHERE o.id=$1 AND l.id=$2 AND o.is_active=TRUE AND f.university_id=$3 AND l.is_active=TRUE`, [optionId,studyLevelId,req.user.university_id]);
    if (!valid.rowCount) return res.status(400).json({ error: "invalid_academic_profile" });
    const result = await pool.query("INSERT INTO subjects(option_id,study_level_id,name,is_active) VALUES($1,$2,$3,TRUE) RETURNING id,name,option_id,study_level_id", [optionId,studyLevelId,name]);
    return res.status(201).json({ subject: result.rows[0] });
  } catch (error) {
    if (error?.code === "23505") return res.status(409).json({ error: "subject_already_exists" });
    return res.status(503).json({ error: "subject_create_failed" });
  }
});

app.get("/api/v1/admin/courses", requireAuth, requireAdmin, async (req,res) => {
  try {
    const result=await pool.query(
      `SELECT c.id,c.name,c.description,s.id AS subject_id,s.name AS subject_name,
        o.id AS option_id,o.name AS option_name,l.id AS study_level_id,l.label AS level_label
       FROM courses c JOIN subjects s ON s.id=c.subject_id
       JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id
       JOIN study_levels l ON l.id=s.study_level_id
       WHERE f.university_id=$1 AND c.is_active=TRUE
       ORDER BY o.name,l.sort_order,s.name,c.name`,
      [req.user.university_id]
    );
    return res.json({data:result.rows});
  } catch { return res.status(503).json({error:"courses_unavailable"}); }
});

app.post("/api/v1/admin/courses", requireAuth, requireAdmin, async (req,res) => {
  const subjectId=Number(req.body?.subjectId);
  const name=typeof req.body?.name==="string"?req.body.name.trim():"";
  const description=typeof req.body?.description==="string"?req.body.description.trim():"";
  if(!Number.isSafeInteger(subjectId)||subjectId<1||!name||name.length>180||description.length>3000)
    return res.status(400).json({error:"invalid_course"});
  try{
    const subject=await pool.query(
      `SELECT s.id FROM subjects s JOIN options o ON o.id=s.option_id
       JOIN faculties f ON f.id=o.faculty_id
       WHERE s.id=$1 AND s.is_active=TRUE AND f.university_id=$2`,
      [subjectId,req.user.university_id]
    );
    if(!subject.rowCount)return res.status(400).json({error:"subject_outside_university"});
    const result=await pool.query(
      "INSERT INTO courses(subject_id,name,description,created_by) VALUES($1,$2,$3,$4) RETURNING id,name,subject_id,description,created_at",
      [subjectId,name,description||null,req.user.id]
    );
    return res.status(201).json({course:result.rows[0]});
  }catch(error){
    if(error?.code==="23505")return res.status(409).json({error:"course_already_exists"});
    return res.status(503).json({error:"course_create_failed"});
  }
});

app.delete("/api/v1/admin/documents/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_document_id" });
  try {
    const found = await pool.query(`SELECT d.id,d.file_key FROM documents d JOIN subjects s ON s.id=d.subject_id JOIN options o ON o.id=s.option_id JOIN faculties f ON f.id=o.faculty_id WHERE d.id=$1 AND f.university_id=$2 AND d.is_active=TRUE`, [id,req.user.university_id]);
    if (!found.rowCount) return res.status(404).json({ error: "document_not_found" });
    await pool.query("UPDATE documents SET is_active=FALSE,updated_at=NOW() WHERE id=$1", [id]);
    await deletePrivateObject(found.rows[0].file_key).catch(error => console.error("Nettoyage fichier document:",error.message));
    return res.status(204).end();
  } catch { return res.status(503).json({ error: "document_delete_failed" }); }
});

app.get("/api/v1/admin/groups", requireAuth, requireAdmin, async (req,res) => {
  try {
    const result=await pool.query(
      `SELECT g.id,g.group_type,g.created_at,f.name AS faculty_name,o.name AS option_name,l.label AS study_level_label,
       (SELECT COUNT(*)::int FROM group_members gm WHERE gm.group_id=g.id) AS member_count
       FROM message_groups g LEFT JOIN faculties f ON f.id=g.faculty_id
       LEFT JOIN options o ON o.id=g.option_id LEFT JOIN study_levels l ON l.id=g.study_level_id
       WHERE g.university_id=$1 AND g.is_active=TRUE ORDER BY g.created_at DESC`,
      [req.user.university_id]
    );
    return res.json({data:result.rows});
  } catch { return res.status(503).json({error:"admin_groups_unavailable"}); }
});

app.post("/api/v1/admin/groups", requireAuth, requireAdmin, async (req, res) => {
  const { groupType, facultyId = null, optionId = null, studyLevelId = null } = req.body || {};
  if (!["faculty","option","class"].includes(groupType)) return res.status(400).json({ error: "invalid_group_type" });
  const ids = [facultyId,optionId,studyLevelId].map(v => v === null || v === "" ? null : Number(v));
  if (ids.some(v => v !== null && (!Number.isSafeInteger(v) || v < 1)) ||
      (groupType === "faculty" && (!ids[0] || ids[1] || ids[2])) ||
      (groupType === "option" && (!ids[0] || !ids[1] || ids[2])) ||
      (groupType === "class" && (!ids[0] || !ids[1] || !ids[2]))) return res.status(400).json({ error: "invalid_group_scope" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const scope = await client.query(`SELECT 1 FROM faculties f LEFT JOIN options o ON o.id=$2 AND o.faculty_id=f.id LEFT JOIN study_levels l ON l.id=$3 AND l.option_id=o.id WHERE f.id=$1 AND f.university_id=$4 AND f.is_active=TRUE AND ($2::bigint IS NULL OR o.id IS NOT NULL) AND ($3::bigint IS NULL OR l.id IS NOT NULL)`, [ids[0],ids[1],ids[2],req.user.university_id]);
    if (!scope.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ error: "invalid_group_scope" }); }
    // Serialize creation requests for the exact same university/group scope.
    // This closes the check-then-insert race when two admins submit simultaneously.
    const groupScopeKey = [req.user.university_id, groupType, ids[0], ids[1] ?? "null", ids[2] ?? "null"].join(":");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [groupScopeKey]);
    const duplicate = await client.query(
      `SELECT id FROM message_groups WHERE university_id=$1 AND group_type=$2
       AND faculty_id IS NOT DISTINCT FROM $3::bigint
       AND option_id IS NOT DISTINCT FROM $4::bigint
       AND study_level_id IS NOT DISTINCT FROM $5::bigint AND is_active=TRUE LIMIT 1`,
      [req.user.university_id,groupType,ids[0],ids[1],ids[2]]
    );
    if (duplicate.rowCount) { await client.query("ROLLBACK"); return res.status(409).json({error:"group_already_exists",message:"Un groupe existe déjà pour ce parcours."}); }
    const created = await client.query("INSERT INTO message_groups(university_id,faculty_id,option_id,study_level_id,group_type,is_active) VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id,group_type,faculty_id,option_id,study_level_id", [req.user.university_id,ids[0],ids[1],ids[2],groupType]);
    const g = created.rows[0];
    await client.query(`INSERT INTO group_members(group_id,user_id) SELECT $1,id FROM users WHERE is_active=TRUE AND university_id=$2 AND role IN ('student','delegate') AND email_verified_at IS NOT NULL AND ($3::bigint IS NULL OR faculty_id=$3) AND ($4::bigint IS NULL OR option_id=$4) AND ($5::bigint IS NULL OR study_level_id=$5) ON CONFLICT DO NOTHING`, [g.id,req.user.university_id,g.faculty_id,g.option_id,g.study_level_id]);
    await client.query("INSERT INTO group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[g.id,req.user.id]);
    await client.query("COMMIT");
    return res.status(201).json({ group:g, message:"Groupe créé et membres inscrits automatiquement." });
  } catch { await client.query("ROLLBACK").catch(() => {}); return res.status(503).json({ error:"group_create_failed" }); }
  finally { client.release(); }
});

app.get("/api/v1/admin/overview", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM documents WHERE is_active=TRUE) AS documents,
      (SELECT COUNT(*)::int FROM announcements WHERE is_active=TRUE) AS announcements,
      (SELECT COUNT(*)::int FROM feedback) AS feedback`);
    return res.json({ data: result.rows[0] });
  } catch { return res.status(503).json({ error: "admin_overview_unavailable" }); }
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(here, "../client/dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

if (!process.env.VERCEL) {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`iFac universite API disponible sur le port ${port}`);
  });

  async function shutdown() {
    server.close(async () => {
      if (pool) await pool.end().catch(() => {});
      process.exit(0);
    });
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export default app;

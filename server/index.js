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
import multer from "multer";
import { mkdir } from "node:fs/promises";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT) || 3434;
const here = path.dirname(fileURLToPath(import.meta.url));
const privateFilesDir = path.resolve(process.env.FILE_STORAGE_DIR || path.join(here, "private-uploads"));
if (!process.env.SUPABASE_URL) await mkdir(privateFilesDir, { recursive: true });
const storageUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const storageKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || "ifac-documents";
const persistentStorageReady = Boolean(storageUrl && storageKey && storageBucket);
function storageObjectUrl(key) {
  return `${storageUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
async function storePrivateObject(key, buffer, contentType) {
  if (!persistentStorageReady) throw new Error("persistent_storage_not_configured");
  const response = await fetch(storageObjectUrl(key), { method: "POST", headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}`, "Content-Type": contentType, "x-upsert": "false" }, body: buffer });
  if (!response.ok) throw new Error(`storage_upload_failed_${response.status}`);
}
async function readPrivateObject(key) {
  if (!persistentStorageReady) throw new Error("persistent_storage_not_configured");
  const response = await fetch(storageObjectUrl(key), { headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` } });
  if (!response.ok) throw new Error(response.status === 404 ? "storage_object_missing" : `storage_download_failed_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function deletePrivateObject(key) {
  if (!persistentStorageReady) throw new Error("persistent_storage_not_configured");
  const response = await fetch(storageObjectUrl(key), { method: "DELETE", headers: { apikey: storageKey, Authorization: `Bearer ${storageKey}` } });
  if (!response.ok && response.status !== 404) throw new Error(`storage_delete_failed_${response.status}`);
}
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    })
  : null;

app.disable("x-powered-by");
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
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const makeToken = () => randomBytes(32).toString("base64url");
const publicUser = (u) => ({
  id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email,
  role: u.role, universityId: u.university_id, facultyId: u.faculty_id,
  optionId: u.option_id, studyLevelId: u.study_level_id
});
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
    req.user = result.rows[0];
    next();
  } catch {
    return res.status(503).json({ error: "service_unavailable" });
  }
}
const requireAdmin = (req, res, next) => req.user?.role === "admin"
  ? next()
  : res.status(403).json({ error: "administrator_required" });

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
    const result = await pool.query(
      "SELECT id, code, name FROM universities WHERE is_active = TRUE ORDER BY name"
    );
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


app.post("/api/v1/auth/register", requireDatabase, async (req, res) => {\n  if (!mailer) return res.status(503).json({ error: "email_service_not_configured", message: "Le service e-mail doit être configuré avant de créer un compte." });
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
    const profile = await client.query(
      `SELECT u.id AS university_id, f.id AS faculty_id, o.id AS option_id, l.id AS study_level_id
       FROM universities u JOIN faculties f ON f.university_id=u.id
       JOIN options o ON o.faculty_id=f.id JOIN study_levels l ON l.option_id=o.id
       WHERE u.code=$1 AND f.code=$2 AND o.code=$3 AND l.code=$4
       AND u.is_active AND f.is_active AND o.is_active AND l.is_active`,
      [universityCode, facultyCode, optionCode, studyLevelCode]
    );
    if (!profile.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_academic_profile" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const role = adminEmail && normalizedEmail === adminEmail ? "admin" : "student";
    const created = await client.query(
      `INSERT INTO users (university_id, faculty_id, option_id, study_level_id, first_name, last_name, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [profile.rows[0].university_id, profile.rows[0].faculty_id, profile.rows[0].option_id, profile.rows[0].study_level_id, firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, role]
    );
    const verificationToken = makeToken();
    await client.query("INSERT INTO email_tokens(user_id,token_hash,purpose,expires_at) VALUES($1,$2,'verify_email',NOW()+INTERVAL '24 hours')", [created.rows[0].id, hashToken(verificationToken)]);
    const verificationUrl = new URL("/verify-email", process.env.APP_BASE_URL || "http://localhost:3435");
    verificationUrl.searchParams.set("token", verificationToken);
    await mailer.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: normalizedEmail, subject: "Confirmez votre adresse e-mail — iFac universite", text: `Pour activer votre compte iFac universite, ouvrez ce lien dans les 24 heures : ${verificationUrl.toString()}\nSi vous n'avez pas demandé ce compte, ignorez ce message.` });
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
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return res.status(400).json({ error: "invalid_token" });
  try {
    const result = await pool.query(
      `UPDATE users SET email_verified_at=NOW(), updated_at=NOW()
       WHERE id=(SELECT user_id FROM email_tokens WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at>NOW())
       RETURNING id`,
      [hashToken(token)]
    );
    if (!result.rowCount) return res.status(400).json({ error: "invalid_or_expired_token" });
    await pool.query("UPDATE email_tokens SET used_at=NOW() WHERE token_hash=$1", [hashToken(token)]);
    return res.json({ message: "Adresse e-mail confirmée. Vous pouvez vous connecter." });
  } catch { return res.status(503).json({ error: "verification_unavailable" }); }
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
      "SELECT user_id FROM email_tokens WHERE token_hash=$1 AND purpose='reset_password' AND used_at IS NULL AND expires_at>NOW() FOR UPDATE",
      [hashToken(token)]
    );
    if (!match.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }
    const passwordHash = await bcrypt.hash(password,12);
    const userId = match.rows[0].user_id;
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
    const result = await pool.query("SELECT * FROM users WHERE email=$1 AND is_active=TRUE", [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "invalid_credentials" });
    if (!user.email_verified_at) return res.status(403).json({ error: "email_not_verified", message: "Confirmez votre adresse e-mail à partir du lien reçu avant de vous connecter." });
    const token = makeToken();
    await pool.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,NOW()+INTERVAL '7 days')", [user.id, hashToken(token)]);
    res.set("Cache-Control", "no-store");
    return res.json({ token, expiresIn: 604800, user: publicUser(user) });
  } catch { return res.status(503).json({ error: "login_unavailable" }); }
});

app.post("/api/v1/auth/logout", requireAuth, async (req, res) => {
  const token = req.get("authorization").slice(7);
  try {
    await pool.query("UPDATE sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL", [hashToken(token)]);
    return res.status(204).end();
  } catch { return res.status(503).json({ error: "logout_unavailable" }); }
});
app.get("/api/v1/auth/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

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
    const result = await pool.query(
      `SELECT id,title,body,starts_at,ends_at,created_at FROM announcements
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
    const result = await pool.query(`SELECT d.title,d.file_key,d.mime_type,d.file_size_bytes FROM documents d JOIN subjects s ON s.id=d.subject_id WHERE d.id=$1 AND d.is_active=TRUE AND s.is_active=TRUE AND s.option_id=$2 AND s.study_level_id=$3`, [id,req.user.option_id,req.user.study_level_id]);
    if (!result.rowCount) return res.status(404).json({ error: "document_not_found" });
    const file = await readPrivateObject(result.rows[0].file_key);
    res.set("Content-Type", result.rows[0].mime_type);
    res.set("Content-Length", String(file.length));
    res.set("Content-Disposition", `attachment; filename="ifac-document-${id}.pdf"`);
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "private, no-store");
    return res.send(file);
  } catch (error) {
    if (error.message === "storage_object_missing") return res.status(404).json({ error: "document_file_missing" });
    if (error.message === "persistent_storage_not_configured") return res.status(503).json({ error: "persistent_storage_not_configured" });
    return res.status(503).json({ error: "document_download_failed" });
  }
});

app.get("/api/v1/documents", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id,d.title,d.mime_type,d.file_size_bytes,d.created_at,s.name AS subject
       FROM documents d JOIN subjects s ON s.id=d.subject_id
       WHERE d.is_active=TRUE AND s.is_active=TRUE AND s.option_id=$1 AND s.study_level_id=$2
       ORDER BY s.name,d.title LIMIT 300`,
      [req.user.option_id,req.user.study_level_id]
    );
    return res.json({ data: result.rows });
  } catch { return res.status(503).json({ error: "documents_unavailable" }); }
});


app.get("/api/v1/messages/groups", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.id,g.group_type FROM message_groups g JOIN group_members gm ON gm.group_id=g.id
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

app.post("/api/v1/admin/announcements", requireAuth, requireAdmin, async (req, res) => {
  const { title, body, facultyId = null, optionId = null, studyLevelId = null, startsAt = null, endsAt = null } = req.body || {};
  if (typeof title !== "string" || !title.trim() || title.length > 220 || typeof body !== "string" || !body.trim() || body.length > 20000) return res.status(400).json({ error: "invalid_announcement" });
  try {
    const result = await pool.query(
      `INSERT INTO announcements(university_id,faculty_id,option_id,study_level_id,title,body,is_active,starts_at,ends_at,created_by)
       VALUES($1,$2,$3,$4,$5,$6,TRUE,$7,$8,$9) RETURNING id,title,body,is_active,starts_at,ends_at,created_at`,
      [req.user.university_id,facultyId,optionId,studyLevelId,title.trim(),body.trim(),startsAt,endsAt,req.user.id]
    );
    return res.status(201).json({ announcement: result.rows[0] });
  } catch { return res.status(400).json({ error: "announcement_create_failed", message: "Vérifiez les dates et les identifiants de ciblage." }); }
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
    const created = await client.query("INSERT INTO message_groups(university_id,faculty_id,option_id,study_level_id,group_type,is_active) VALUES($1,$2,$3,$4,$5,TRUE) RETURNING id,group_type,faculty_id,option_id,study_level_id", [req.user.university_id,ids[0],ids[1],ids[2],groupType]);
    const g = created.rows[0];
    await client.query(`INSERT INTO group_members(group_id,user_id) SELECT $1,id FROM users WHERE is_active=TRUE AND university_id=$2 AND ($3::bigint IS NULL OR faculty_id=$3) AND ($4::bigint IS NULL OR option_id=$4) AND ($5::bigint IS NULL OR study_level_id=$5) ON CONFLICT DO NOTHING`, [g.id,req.user.university_id,g.faculty_id,g.option_id,g.study_level_id]);
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

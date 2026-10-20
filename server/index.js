import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT) || 3434;
const here = path.dirname(fileURLToPath(import.meta.url));
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
app.use(express.json({ limit: "1mb" }));

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

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(here, "../client/dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

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

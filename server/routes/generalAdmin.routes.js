import express from "express";
import { randomUUID } from "node:crypto";

const idOf = value => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
const textOf = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function createGeneralAdminRouter({ pool, requireAuth }) {
  const router = express.Router();

  async function requireGeneralAdmin(req, res, next) {
    try {
      if (req.user?.role === "admin") return next();
      const found = await pool.query(
        "SELECT 1 FROM role_assignments WHERE user_id=$1 AND role='admin_general' AND status='active' LIMIT 1",
        [req.user.id]
      );
      if (!found.rowCount) return res.status(403).json({ error: "general_admin_required", message: "Accès réservé à l’administrateur général." });
      next();
    } catch {
      return res.status(503).json({ error: "general_admin_check_unavailable" });
    }
  }

  const guard = [requireAuth, requireGeneralAdmin];

  async function audit(req, action, targetType, targetId = null, universityId = null, metadata = {}) {
    await pool.query(
      "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
      [req.user.id, action, targetType, targetId, universityId, JSON.stringify(metadata)]
    );
  }

  router.get("/general-admin/overview", ...guard, async (_req, res) => {
    try {
      const [universities, activeUniversities, users, activeUsers, students, professors, universityAdmins, documents, subscriptions, invoices, feedback] = await Promise.all([
        pool.query("SELECT COUNT(*)::int total FROM universities"),
        pool.query("SELECT COUNT(*)::int total FROM universities WHERE is_active=TRUE"),
        pool.query("SELECT COUNT(*)::int total FROM users"),
        pool.query("SELECT COUNT(*)::int total FROM users WHERE is_active=TRUE"),
        pool.query("SELECT COUNT(*)::int total FROM users WHERE role IN ('student','delegate') AND is_active=TRUE"),
        pool.query("SELECT COUNT(DISTINCT pa.invite_id)::int total FROM professor_assignments pa WHERE pa.is_active=TRUE"),
        pool.query("SELECT COUNT(DISTINCT user_id)::int total FROM role_assignments WHERE role='university_admin' AND status='active'"),
        pool.query("SELECT COUNT(*)::int total FROM documents WHERE is_active=TRUE"),
        pool.query("SELECT COUNT(*)::int total FROM university_subscriptions WHERE status IN ('trialing','active','past_due')"),
        pool.query("SELECT COUNT(*)::int total FROM billing_records WHERE status IN ('issued','overdue')"),
        pool.query("SELECT COUNT(*)::int total FROM feedback")
      ]);
      return res.json({ data: {
        universities: universities.rows[0].total, activeUniversities: activeUniversities.rows[0].total,
        users: users.rows[0].total, activeUsers: activeUsers.rows[0].total, students: students.rows[0].total,
        professors: professors.rows[0].total, universityAdmins: universityAdmins.rows[0].total,
        documents: documents.rows[0].total, subscriptions: subscriptions.rows[0].total,
        unpaidInvoices: invoices.rows[0].total, feedback: feedback.rows[0].total
      }});
    } catch (error) {
      console.error("general-admin overview:", error.message);
      return res.status(503).json({ error: "general_admin_overview_unavailable", message: "La migration commerciale doit être appliquée et la base vérifiée." });
    }
  });

  router.get("/general-admin/universities", ...guard, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT u.id,u.code,u.name,u.is_active,u.registration_enabled,u.created_at,
          (SELECT COUNT(*)::int FROM faculties f WHERE f.university_id=u.id) faculties,
          (SELECT COUNT(*)::int FROM users x WHERE x.university_id=u.id AND x.is_active=TRUE) users,
          (SELECT COUNT(*)::int FROM role_assignments ra WHERE ra.university_id=u.id AND ra.role='university_admin' AND ra.status='active') admins,
          (SELECT s.status FROM university_subscriptions s WHERE s.university_id=u.id AND s.status IN ('trialing','active','past_due','suspended') ORDER BY s.created_at DESC LIMIT 1) subscription_status,
          (SELECT p.name FROM university_subscriptions s JOIN saas_plans p ON p.id=s.plan_id WHERE s.university_id=u.id AND s.status IN ('trialing','active','past_due','suspended') ORDER BY s.created_at DESC LIMIT 1) plan_name
        FROM universities u ORDER BY u.created_at DESC,u.name`);
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "general_admin_universities_unavailable" }); }
  });

  router.post("/general-admin/universities", ...guard, async (req, res) => {
    const code = textOf(req.body?.code, 32).toUpperCase();
    const name = textOf(req.body?.name, 180);
    if (!/^[A-Z0-9_-]{2,32}$/.test(code) || name.length < 2) return res.status(400).json({ error: "invalid_university", message: "Indiquez un code unique (2 à 32 caractères) et le nom de l’université." });
    try {
      const result = await pool.query(
        "INSERT INTO universities(code,name,is_active,registration_enabled) VALUES($1,$2,TRUE,FALSE) RETURNING id,code,name,is_active,registration_enabled,created_at",
        [code,name]
      );
      await audit(req, "university.created", "university", result.rows[0].id, result.rows[0].id, { code, name });
      return res.status(201).json({ university: result.rows[0], message: "Université créée en mode configuration. Nommez son responsable ; il pourra créer les facultés, options et niveaux avant l’ouverture des inscriptions." });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "university_code_exists", message: "Ce code d’université existe déjà." });
      return res.status(503).json({ error: "university_create_failed" });
    }
  });

  router.patch("/general-admin/universities/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id);
    const name = textOf(req.body?.name, 180);
    const code = textOf(req.body?.code, 32).toUpperCase();
    const isActive = req.body?.isActive;
    if (!id || name.length < 2 || !/^[A-Z0-9_-]{2,32}$/.test(code) || typeof isActive !== "boolean") return res.status(400).json({ error: "invalid_university_update" });
    try {
      const result = await pool.query(
        "UPDATE universities SET code=$1,name=$2,is_active=$3,updated_at=NOW() WHERE id=$4 RETURNING id,code,name,is_active",
        [code,name,isActive,id]
      );
      if (!result.rowCount) return res.status(404).json({ error: "university_not_found" });
      await audit(req, isActive ? "university.activated" : "university.deactivated", "university", id, id, { code, name });
      return res.json({ university: result.rows[0], message: "Université mise à jour." });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "university_code_exists" });
      return res.status(503).json({ error: "university_update_failed" });
    }
  });

  router.get("/general-admin/university-admins", ...guard, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT ra.id assignment_id,ra.status,ra.created_at,u.id user_id,u.first_name,u.last_name,u.email,
          un.id university_id,un.name university_name
        FROM role_assignments ra JOIN users u ON u.id=ra.user_id
        JOIN universities un ON un.id=ra.university_id
        WHERE ra.role='university_admin' ORDER BY un.name,u.last_name,u.first_name`);
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "general_admin_university_admins_unavailable" }); }
  });

  router.post("/general-admin/university-admins", ...guard, async (req, res) => {
    const email = textOf(req.body?.email, 254).toLowerCase();
    const universityId = idOf(req.body?.universityId);
    if (!universityId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "invalid_university_admin" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const university = await client.query("SELECT id,name FROM universities WHERE id=$1 AND is_active=TRUE FOR UPDATE", [universityId]);
      const user = await client.query("SELECT id,is_active FROM users WHERE lower(email)=lower($1)", [email]);
      if (!university.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "university_not_found" }); }
      if (!user.rowCount || !user.rows[0].is_active) { await client.query("ROLLBACK"); return res.status(404).json({ error: "account_not_found", message: "La personne doit d’abord créer un compte iFac actif." }); }
      const existing = await client.query(
        "SELECT id,status FROM role_assignments WHERE user_id=$1 AND role='university_admin' AND university_id=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [user.rows[0].id,universityId]
      );
      if (existing.rows[0]?.status === "active") { await client.query("ROLLBACK"); return res.status(409).json({ error: "already_assigned", message: "Ce compte administre déjà cette université." }); }
      if (existing.rowCount) {
        await client.query("UPDATE role_assignments SET status='active',assigned_by=$1,approved_by=$1,revoked_at=NULL,updated_at=NOW() WHERE id=$2", [req.user.id,existing.rows[0].id]);
      } else {
        await client.query(
          "INSERT INTO role_assignments(user_id,role,university_id,status,assigned_by,approved_by) VALUES($1,'university_admin',$2,'active',$3,$3)",
          [user.rows[0].id,universityId,req.user.id]
        );
      }
      await client.query(
        "INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,metadata) VALUES($1,'university_admin.appointed','role_assignment',$2,$3,$4::jsonb)",
        [req.user.id,user.rows[0].id,universityId,JSON.stringify({ email })]
      );
      await client.query("COMMIT");
      return res.status(201).json({ message: "Administrateur d’université nommé. Il verra son espace dédié à sa prochaine connexion." });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23514") return res.status(409).json({ error: "university_admin_limit", message: "Cette université possède déjà deux administrateurs actifs." });
      console.error("university admin appointment:", error.message);
      return res.status(503).json({ error: "university_admin_appointment_failed" });
    } finally { client.release(); }
  });

  router.patch("/general-admin/university-admins/:id/status", ...guard, async (req, res) => {
    const assignmentId = idOf(req.params.id);
    const active = req.body?.active;
    if (!assignmentId || typeof active !== "boolean") return res.status(400).json({ error: "invalid_assignment_status" });
    try {
      const result = await pool.query(
        "UPDATE role_assignments SET status=$1,assigned_by=CASE WHEN $1='active' THEN COALESCE(assigned_by,$3) ELSE assigned_by END,approved_by=CASE WHEN $1='active' THEN $3 ELSE approved_by END,revoked_at=CASE WHEN $1='revoked' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$2 AND role='university_admin' RETURNING id,user_id,university_id,status",
        [active ? "active" : "revoked",assignmentId,req.user.id]
      );
      if (!result.rowCount) return res.status(404).json({ error: "assignment_not_found" });
      await audit(req, active ? "university_admin.reactivated" : "university_admin.revoked", "role_assignment", assignmentId, result.rows[0].university_id, { userId: result.rows[0].user_id });
      return res.json({ message: active ? "Accès administrateur réactivé." : "Accès administrateur retiré." });
    } catch (error) {
      if (error.code === "23514") return res.status(409).json({ error: "university_admin_limit", message: "La limite de deux administrateurs actifs est atteinte." });
      return res.status(503).json({ error: "university_admin_status_failed" });
    }
  });

  router.get("/general-admin/users", ...guard, async (req, res) => {
    const search = textOf(req.query.search, 100);
    const role = textOf(req.query.role, 32);
    const active = req.query.active === "true" ? true : req.query.active === "false" ? false : null;
    try {
      const result = await pool.query(`
        SELECT u.id,u.first_name,u.last_name,u.email,u.role,u.is_active,u.email_verified_at,u.created_at,
          un.name university_name,f.name faculty_name,o.name option_name,
          COALESCE(ra.role,CASE WHEN u.role='admin' THEN 'admin_general' ELSE u.role END) effective_role
        FROM users u LEFT JOIN universities un ON un.id=u.university_id
        LEFT JOIN faculties f ON f.id=u.faculty_id LEFT JOIN options o ON o.id=u.option_id
        LEFT JOIN LATERAL (
          SELECT role FROM role_assignments WHERE user_id=u.id AND status='active'
          ORDER BY CASE role WHEN 'admin_general' THEN 1 WHEN 'university_admin' THEN 2 WHEN 'faculty_manager' THEN 3 WHEN 'program_manager' THEN 4 WHEN 'professor' THEN 5 ELSE 9 END LIMIT 1
        ) ra ON TRUE
        WHERE ($1='' OR lower(u.email) LIKE '%'||lower($1)||'%' OR lower(u.first_name||' '||u.last_name) LIKE '%'||lower($1)||'%')
          AND ($2='' OR COALESCE(ra.role,CASE WHEN u.role='admin' THEN 'admin_general' ELSE u.role END)=$2)
          AND ($3::boolean IS NULL OR u.is_active=$3)
        ORDER BY u.created_at DESC LIMIT 300`,
        [search,role,active]
      );
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "general_admin_users_unavailable" }); }
  });

  router.patch("/general-admin/users/:id/status", ...guard, async (req, res) => {
    const userId = idOf(req.params.id);
    const active = req.body?.active;
    if (!userId || typeof active !== "boolean") return res.status(400).json({ error: "invalid_user_status" });
    if (userId === Number(req.user.id) && !active) return res.status(400).json({ error: "cannot_disable_self", message: "Vous ne pouvez pas désactiver votre propre compte." });
    try {
      const target = await pool.query(
        "SELECT u.id,u.role,ra.role AS assigned_role FROM users u LEFT JOIN LATERAL (SELECT role FROM role_assignments WHERE user_id=u.id AND status='active' ORDER BY CASE role WHEN 'admin_general' THEN 1 ELSE 9 END LIMIT 1) ra ON TRUE WHERE u.id=$1",
        [userId]
      );
      if (!target.rowCount) return res.status(404).json({ error: "user_not_found" });
      if (target.rows[0].role === "admin" || target.rows[0].assigned_role === "admin_general") return res.status(403).json({ error: "protected_general_admin", message: "Un administrateur général ne peut pas être désactivé depuis cette liste." });
      await pool.query("UPDATE users SET is_active=$1,disabled_at=CASE WHEN $1 THEN NULL ELSE NOW() END,updated_at=NOW() WHERE id=$2", [active,userId]);
      if (!active) await pool.query("UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", [userId]);
      await audit(req, active ? "user.reactivated" : "user.suspended", "user", userId, null, {});
      return res.json({ message: active ? "Compte réactivé." : "Compte suspendu. Ses sessions ont été fermées." });
    } catch { return res.status(503).json({ error: "user_status_update_failed" }); }
  });

  router.get("/general-admin/plans", ...guard, async (_req, res) => {
    try {
      const result = await pool.query("SELECT id,code,name,description,amount_cents,currency,billing_interval,limits,is_active,created_at FROM saas_plans ORDER BY amount_cents,name");
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "plans_unavailable" }); }
  });

  router.post("/general-admin/plans", ...guard, async (req, res) => {
    const code = textOf(req.body?.code, 40).toLowerCase();
    const name = textOf(req.body?.name, 120);
    const description = textOf(req.body?.description, 2000);
    const amount = Number(req.body?.amountCents);
    const currency = textOf(req.body?.currency || "USD", 3).toUpperCase();
    const interval = req.body?.billingInterval;
    if (!/^[a-z0-9_-]{2,40}$/.test(code) || name.length < 2 || !Number.isSafeInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency) || !["monthly","yearly","one_time"].includes(interval)) return res.status(400).json({ error: "invalid_plan" });
    try {
      const result = await pool.query("INSERT INTO saas_plans(code,name,description,amount_cents,currency,billing_interval) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [code,name,description||null,amount,currency,interval]);
      await audit(req, "saas_plan.created", "saas_plan", result.rows[0].id);
      return res.status(201).json({ plan: result.rows[0], message: "Forfait créé." });
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ error: "plan_code_exists" });
      return res.status(503).json({ error: "plan_create_failed" });
    }
  });

  router.patch("/general-admin/plans/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id), name = textOf(req.body?.name,120), description = textOf(req.body?.description,2000);
    const amount = Number(req.body?.amountCents), currency = textOf(req.body?.currency,3).toUpperCase(), interval = req.body?.billingInterval, active = req.body?.isActive;
    if (!id || name.length < 2 || !Number.isSafeInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency) || !["monthly","yearly","one_time"].includes(interval) || typeof active !== "boolean") return res.status(400).json({ error: "invalid_plan_update" });
    try {
      const result = await pool.query("UPDATE saas_plans SET name=$1,description=$2,amount_cents=$3,currency=$4,billing_interval=$5,is_active=$6,updated_at=NOW() WHERE id=$7 RETURNING *", [name,description||null,amount,currency,interval,active,id]);
      if (!result.rowCount) return res.status(404).json({ error: "plan_not_found" });
      await audit(req, "saas_plan.updated", "saas_plan", id, null, { isActive: active });
      return res.json({ plan: result.rows[0], message: "Forfait mis à jour." });
    } catch { return res.status(503).json({ error: "plan_update_failed" }); }
  });

  router.get("/general-admin/subscriptions", ...guard, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT s.id,s.status,s.starts_at,s.ends_at,s.grace_until,s.notes,s.created_at,
          u.id university_id,u.name university_name,p.id plan_id,p.name plan_name,p.amount_cents,p.currency,p.billing_interval
        FROM university_subscriptions s JOIN universities u ON u.id=s.university_id
        JOIN saas_plans p ON p.id=s.plan_id ORDER BY s.created_at DESC LIMIT 500`);
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "subscriptions_unavailable" }); }
  });

  router.post("/general-admin/subscriptions", ...guard, async (req, res) => {
    const universityId = idOf(req.body?.universityId), planId = idOf(req.body?.planId);
    const status = ["trialing","active","past_due","suspended","canceled"].includes(req.body?.status) ? req.body.status : "trialing";
    const notes = textOf(req.body?.notes,2000);
    if (!universityId || !planId) return res.status(400).json({ error: "invalid_subscription" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const valid = await client.query("SELECT 1 FROM universities WHERE id=$1 FOR UPDATE", [universityId]);
      const plan = await client.query("SELECT id FROM saas_plans WHERE id=$1 AND is_active=TRUE", [planId]);
      if (!valid.rowCount || !plan.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ error: "invalid_subscription_scope" }); }
      await client.query("UPDATE university_subscriptions SET status='canceled',updated_at=NOW() WHERE university_id=$1 AND status IN ('trialing','active','past_due','suspended')", [universityId]);
      const created = await client.query("INSERT INTO university_subscriptions(university_id,plan_id,status,notes,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id", [universityId,planId,status,notes||null,req.user.id]);
      await client.query("INSERT INTO admin_audit_logs(actor_user_id,action,target_type,target_id,university_id,metadata) VALUES($1,'subscription.created','university_subscription',$2,$3,$4::jsonb)", [req.user.id,created.rows[0].id,universityId,JSON.stringify({planId,status})]);
      await client.query("COMMIT");
      return res.status(201).json({ message: "Abonnement enregistré. Aucun paiement automatique n’a été déclenché." });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(503).json({ error: "subscription_create_failed" });
    } finally { client.release(); }
  });

  router.patch("/general-admin/subscriptions/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id), status = req.body?.status;
    const endsAt = req.body?.endsAt || null, graceUntil = req.body?.graceUntil || null, notes = textOf(req.body?.notes,2000);
    if (!id || !["trialing","active","past_due","suspended","canceled"].includes(status)) return res.status(400).json({ error: "invalid_subscription_update" });
    try {
      const result = await pool.query("UPDATE university_subscriptions SET status=$1,ends_at=$2,grace_until=$3,notes=$4,updated_at=NOW() WHERE id=$5 RETURNING id,university_id,status", [status,endsAt,graceUntil,notes||null,id]);
      if (!result.rowCount) return res.status(404).json({ error: "subscription_not_found" });
      await audit(req, "subscription.status_changed", "university_subscription", id, result.rows[0].university_id, { status });
      return res.json({ message: "Statut de l’abonnement mis à jour." });
    } catch { return res.status(503).json({ error: "subscription_update_failed" }); }
  });

  router.get("/general-admin/billing", ...guard, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT b.id,b.invoice_number,b.amount_cents,b.currency,b.status,b.issued_at,b.due_at,b.paid_at,b.payment_reference,b.notes,
          u.id university_id,u.name university_name
        FROM billing_records b JOIN universities u ON u.id=b.university_id
        ORDER BY b.issued_at DESC LIMIT 500`);
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "billing_records_unavailable" }); }
  });

  router.post("/general-admin/billing", ...guard, async (req, res) => {
    const universityId = idOf(req.body?.universityId), subscriptionId = req.body?.subscriptionId ? idOf(req.body.subscriptionId) : null;
    const amount = Number(req.body?.amountCents), currency = textOf(req.body?.currency || "USD",3).toUpperCase();
    const dueAt = req.body?.dueAt || null, notes = textOf(req.body?.notes,2000);
    if (!universityId || !Number.isSafeInteger(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "invalid_invoice" });
    const invoiceNumber = "IFAC-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + randomUUID().slice(0,8).toUpperCase();
    try {
      if (subscriptionId) {
        const linked = await pool.query("SELECT 1 FROM university_subscriptions WHERE id=$1 AND university_id=$2", [subscriptionId,universityId]);
        if (!linked.rowCount) return res.status(400).json({ error: "invoice_subscription_mismatch" });
      }
      const result = await pool.query("INSERT INTO billing_records(subscription_id,university_id,invoice_number,amount_cents,currency,status,due_at,notes,created_by) VALUES($1,$2,$3,$4,$5,'issued',$6,$7,$8) RETURNING id,invoice_number,status", [subscriptionId,universityId,invoiceNumber,amount,currency,dueAt,notes||null,req.user.id]);
      await audit(req, "invoice.issued", "billing_record", result.rows[0].id, universityId, { invoiceNumber,amount,currency });
      return res.status(201).json({ invoice: result.rows[0], message: "Facture enregistrée. Elle n’a pas été envoyée ni encaissée automatiquement." });
    } catch { return res.status(503).json({ error: "invoice_create_failed" }); }
  });

  router.patch("/general-admin/billing/:id", ...guard, async (req, res) => {
    const id = idOf(req.params.id), status = req.body?.status;
    const reference = textOf(req.body?.paymentReference,180);
    if (!id || !["paid","void","overdue","issued"].includes(status)) return res.status(400).json({ error: "invalid_invoice_status" });
    try {
      const result = await pool.query("UPDATE billing_records SET status=$1,paid_at=CASE WHEN $1='paid' THEN NOW() ELSE NULL END,payment_reference=COALESCE(NULLIF($2,''),payment_reference) WHERE id=$3 RETURNING id,university_id,invoice_number,status", [status,reference,id]);
      if (!result.rowCount) return res.status(404).json({ error: "invoice_not_found" });
      await audit(req, "invoice.status_changed", "billing_record", id, result.rows[0].university_id, { status,reference });
      return res.json({ message: status === "paid" ? "Facture marquée comme payée. Vérifiez le paiement réel avant cette action." : "Statut de facture mis à jour." });
    } catch { return res.status(503).json({ error: "invoice_update_failed" }); }
  });

  router.get("/general-admin/audit", ...guard, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT a.id,a.action,a.target_type,a.target_id,a.university_id,a.metadata,a.created_at,
          u.first_name,u.last_name,u.email,un.name university_name
        FROM admin_audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id
        LEFT JOIN universities un ON un.id=a.university_id
        ORDER BY a.created_at DESC LIMIT 300`);
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "audit_logs_unavailable" }); }
  });

  router.get("/general-admin/feedback", ...guard, async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT f.id,f.category,f.message,f.rating,f.created_at,u.first_name,u.last_name,u.email
        FROM feedback f LEFT JOIN users u ON u.id=f.user_id
        ORDER BY f.created_at DESC LIMIT 300`);
      return res.json({ data: result.rows });
    } catch { return res.status(503).json({ error: "feedback_unavailable" }); }
  });

  return router;
}

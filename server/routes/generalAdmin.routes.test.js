import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createGeneralAdminRouter } from "./generalAdmin.routes.js";

async function withApi(pool, run) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => {
    req.user = { id: 1, role: "admin" };
    next();
  };
  app.use(createGeneralAdminRouter({ pool, requireAuth }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("new universities stay closed to student registration until their hierarchy is ready", async () => {
  const calls = [];
  const created = {
    id: 91,
    code: "NEWUNI",
    name: "Nouvelle université",
    is_active: true,
    registration_enabled: false,
    created_at: "2026-11-10T00:00:00.000Z"
  };
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("INSERT INTO universities")) return { rows: [created], rowCount: 1 };
      if (sql.includes("INSERT INTO admin_audit_logs")) return { rows: [{ id: 1 }], rowCount: 1 };
      throw new Error("Unexpected query: " + sql);
    }
  };

  await withApi(pool, async base => {
    const response = await fetch(base + "/general-admin/universities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "newuni", name: "Nouvelle université" })
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.university.registration_enabled, false);
    assert.match(body.message, /restera absente de l’inscription étudiante/i);

    const insert = calls.find(call => call.sql.includes("INSERT INTO universities"));
    assert.match(insert.sql, /VALUES\(\$1,\$2,TRUE,FALSE\)/);
    assert.deepEqual(insert.params, ["NEWUNI", "Nouvelle université"]);
  });
});


test("revoking the last active university administrator closes student registration", async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("UPDATE role_assignments SET status")) {
        return { rows: [{ id: 7, user_id: 31, university_id: 10, status: "revoked" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE universities u") && sql.includes("registration_enabled=FALSE")) {
        return { rows: [{ id: 10 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO admin_audit_logs")) return { rows: [{ id: 1 }], rowCount: 1 };
      throw new Error("Unexpected query: " + sql);
    }
  };
  await withApi(pool, async base => {
    const response = await fetch(base + "/general-admin/university-admins/7/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.match(body.message, /inscriptions étudiantes ont été fermées/i);
    assert.equal(calls.some(call => call.sql.includes("registration_enabled=FALSE")), true);
    assert.equal(calls.filter(call => call.sql.includes("INSERT INTO admin_audit_logs")).length, 2);
  });
});

test("revoking one university administrator keeps registration open when another remains active", async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("UPDATE role_assignments SET status")) {
        return { rows: [{ id: 8, user_id: 32, university_id: 10, status: "revoked" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE universities u") && sql.includes("registration_enabled=FALSE")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO admin_audit_logs")) return { rows: [{ id: 1 }], rowCount: 1 };
      throw new Error("Unexpected query: " + sql);
    }
  };
  await withApi(pool, async base => {
    const response = await fetch(base + "/general-admin/university-admins/8/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.message, "Accès administrateur retiré.");
    assert.equal(calls.some(call => call.sql.includes("registration_enabled=FALSE") && call.sql.includes("UPDATE universities u")), true);
    assert.equal(calls.filter(call => call.sql.includes("INSERT INTO admin_audit_logs")).length, 1);
  });
});

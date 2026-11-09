import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createUniversityCatalogRouter } from "./universityCatalog.routes.js";

async function withApi(pool, run) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => { req.user = { id: 42 }; next(); };
  app.use(createUniversityCatalogRouter({ pool, requireAuth }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function makePool({ scopes = [], query = async () => ({ rows: [], rowCount: 0 }), clientQuery = async () => ({ rows: [], rowCount: 0 }) } = {}) {
  const calls = [];
  const pool = {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params, source: "pool" });
      if (sql.includes("FROM role_assignments ra")) return { rows: scopes, rowCount: scopes.length };
      return query(sql, params);
    },
    async connect() {
      return {
        async query(sql, params = []) {
          calls.push({ sql, params, source: "client" });
          return clientQuery(sql, params);
        },
        release() {}
      };
    }
  };
  return pool;
}

test("faculty creation derives university_id from the active server-side assignment", async () => {
  const pool = makePool({
    scopes: [{ assignment_id: 7, university_id: 10, university_name: "Université A", registration_enabled: false }],
    clientQuery: async (sql, params) => sql.includes("INSERT INTO faculties")
      ? { rows: [{ id: 90, university_id: params[0], code: params[1], name: params[2], is_active: true }], rowCount: 1 }
      : { rows: [], rowCount: 1 }
  });
  await withApi(pool, async base => {
    const response = await fetch(base + "/university-admin/faculties", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeAssignmentId: 7, universityId: 999, code: "FSE", name: "Sciences de l’éducation" })
    });
    assert.equal(response.status, 201);
    const insert = pool.calls.find(call => call.sql.includes("INSERT INTO faculties"));
    assert.equal(insert.params[0], 10);
    assert.notEqual(insert.params[0], 999);
  });
});

test("faculty creation requires an explicit assignment when the user administers multiple universities", async () => {
  const pool = makePool({
    scopes: [
      { assignment_id: 7, university_id: 10, university_name: "Université A" },
      { assignment_id: 8, university_id: 20, university_name: "Université B" }
    ]
  });
  await withApi(pool, async base => {
    const response = await fetch(base + "/university-admin/faculties", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "FSE", name: "Sciences de l’éducation" })
    });
    assert.equal(response.status, 400);
    assert.equal(pool.calls.some(call => call.sql.includes("INSERT INTO faculties")), false);
  });
});

test("an option cannot be created in a faculty outside the administrator's universities", async () => {
  const pool = makePool({
    scopes: [{ assignment_id: 7, university_id: 10, university_name: "Université A" }],
    query: async sql => sql.includes("SELECT id,university_id FROM faculties")
      ? { rows: [], rowCount: 0 }
      : { rows: [], rowCount: 0 }
  });
  await withApi(pool, async base => {
    const response = await fetch(base + "/university-admin/options", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facultyId: 555, code: "PSY", name: "Psychopédagogie" })
    });
    assert.equal(response.status, 404);
    assert.equal(pool.calls.some(call => call.sql.includes("INSERT INTO options")), false);
  });
});

test("student registration cannot be enabled before the academic catalogue is complete", async () => {
  const pool = makePool({
    scopes: [{ assignment_id: 7, university_id: 10, university_name: "Université A" }],
    query: async sql => sql.includes("SELECT COUNT(DISTINCT f.id)")
      ? { rows: [{ faculties: 0, options: 0, levels: 0 }], rowCount: 1 }
      : { rows: [], rowCount: 0 }
  });
  await withApi(pool, async base => {
    const response = await fetch(base + "/university-admin/registration/enable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopeAssignmentId: 7 })
    });
    const body = await response.json();
    assert.equal(response.status, 409);
    assert.equal(body.error, "academic_catalog_incomplete");
    assert.equal(pool.calls.some(call => call.sql.includes("UPDATE universities SET registration_enabled")), false);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createRoleRegistrationRouter } from "./roleRegistration.routes.js";

async function withApi({ pool, authResult, authCalls }, run) {
  const app = express();
  app.use(express.json());
  app.use(createRoleRegistrationRouter({
    pool,
    supabaseAuth: async (...args) => { authCalls.push(args); return authResult; }
  }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run("http://127.0.0.1:" + address.port); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

function validBody(overrides = {}) {
  return {
    firstName: "Marie", lastName: "Pierre", email: "marie@example.com",
    password: "secure-pass-123", role: "program_manager",
    universityId: 10, facultyId: 20, optionId: 30, studyLevelId: 40,
    ...overrides
  };
}

test("responsible registration rejects global administrator self-assignment", async () => {
  let authCalls = [];
  const pool = { async query() { throw new Error("database should not be called"); } };
  await withApi({ pool, authResult: { response: { ok: true }, data: { user: { id: "auth-1" } } }, authCalls }, async base => {
    const response = await fetch(base + "/auth/responsible/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody({ role: "admin_general" }))
    });
    assert.equal(response.status, 400);
    assert.equal(authCalls.length, 0);
  });
});

test("responsible registration rejects a faculty outside the selected university", async () => {
  const authCalls = [];
  const pool = { async query() {
    return { rows: [{ university_id: 10, faculty_id: null, option_id: null, study_level_id: null }], rowCount: 1 };
  } };
  await withApi({ pool, authResult: { response: { ok: true }, data: { user: { id: "auth-1" } } }, authCalls }, async base => {
    const response = await fetch(base + "/auth/responsible/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody())
    });
    assert.equal(response.status, 400);
    assert.equal(authCalls.length, 0);
  });
});

test("program manager self-registration creates a pending scoped role request", async () => {
  const authCalls = [];
  const statements = [];
  const selected = { university_id: 10, faculty_id: 20, option_id: 30, study_level_id: 40 };
  const pool = {
    async query(sql) {
      if (sql.includes("FROM universities")) return { rows: [selected], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return {
        async query(sql, params = []) {
          statements.push({ sql, params });
          if (sql.includes("INSERT INTO users")) return { rows: [{ id: 72 }], rowCount: 1 };
          if (sql.includes("INSERT INTO role_assignments")) return { rows: [{ id: 81, status: "pending" }], rowCount: 1 };
          return { rows: [], rowCount: 1 };
        },
        release() {}
      };
    }
  };
  await withApi({
    pool,
    authResult: { response: { ok: true }, data: { user: { id: "00000000-0000-4000-8000-000000000001" } } },
    authCalls
  }, async base => {
    const response = await fetch(base + "/auth/responsible/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody())
    });
    const data = await response.json();
    assert.equal(response.status, 201);
    assert.equal(data.status, "pending");
    assert.match(data.message, /responsable de votre faculté/);
    const roleInsert = statements.find(item => item.sql.includes("INSERT INTO role_assignments"));
    assert.deepEqual(roleInsert.params, [72, "program_manager", 10, 20, 30, 40]);
    assert.equal(statements.some(item => item.sql === "COMMIT"), true);
    assert.equal(authCalls.length, 1);
  });
});

test("responsible account email cannot be registered twice", async () => {
  const authCalls = [];
  const pool = { async query(sql) {
    return sql.includes("FROM universities") ? { rows: [{ university_id: 10, faculty_id: 20, option_id: 30, study_level_id: 40 }], rowCount: 1 }
      : { rows: [{ id: 22 }], rowCount: 1 };
  } };
  await withApi({ pool, authResult: { response: { ok: true }, data: { user: { id: "auth-1" } } }, authCalls }, async base => {
    const response = await fetch(base + "/auth/responsible/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody())
    });
    assert.equal(response.status, 409);
    assert.equal(authCalls.length, 0);
  });
});

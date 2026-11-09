import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createFacultyManagerRouter } from "./facultyManager.routes.js";

async function withApi(pool, run) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => { req.user = { id: 62 }; next(); };
  app.use(createFacultyManagerRouter({ pool, requireAuth, readPrivateObject: async () => Buffer.alloc(0) }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run("http://127.0.0.1:" + address.port); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("faculty manager cannot appoint a program manager in another faculty", async () => {
  const calls = [];
  const pool = {
    async query(sql, params = []) {
      calls.push({ sql, params, source: "pool" });
      if (sql.includes("SELECT ra.id AS role_assignment_id")) {
        return { rows: [{ role_assignment_id: 4, university_id: 10, faculty_id: 20, university_name: "Université A", faculty_name: "Faculté A" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      return {
        async query(sql, params = []) {
          calls.push({ sql, params, source: "client" });
          if (sql.includes("SELECT o.id,f.id AS faculty_id,f.university_id")) return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 1 };
        },
        release() {}
      };
    }
  };
  await withApi(pool, async base => {
    const response = await fetch(base + "/faculty-manager/program-managers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "responsable@example.com", optionId: 999, studyLevelId: null })
    });
    assert.equal(response.status, 403);
    assert.equal(calls.some(call => call.sql.includes("INSERT INTO role_assignments")), false);
  });
});

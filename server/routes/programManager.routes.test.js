import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createProgramManagerRouter } from "./programManager.routes.js";

async function withApi(pool, run) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _res, next) => { req.user = { id: 52 }; next(); };
  app.use(createProgramManagerRouter({ pool, requireAuth }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run("http://127.0.0.1:" + address.port); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

function makePool({ allowed = true } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("SELECT ra.university_id,ra.faculty_id,ra.option_id,ra.study_level_id")) {
        return { rows: [{ university_id: 10, faculty_id: 20, option_id: 30, study_level_id: null, university_name: "Université A", faculty_name: "Faculté A", option_name: "Psychopédagogie", study_level_label: null }], rowCount: 1 };
      }
      if (sql.includes("SELECT o.id,o.faculty_id,f.university_id,l.id AS study_level_id")) {
        return allowed
          ? { rows: [{ id: 30, faculty_id: 20, university_id: 10, study_level_id: 40 }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO subjects")) {
        return { rows: [{ id: 80, name: params[2], option_id: params[0], study_level_id: params[1] }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }
  };
}

test("program manager can create a subject only inside the assigned program", async () => {
  const pool = makePool({ allowed: true });
  await withApi(pool, async base => {
    const response = await fetch(base + "/program-manager/subjects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: 30, studyLevelId: 40, name: "Psychologie de l’apprentissage" })
    });
    assert.equal(response.status, 201);
    const insert = pool.calls.find(call => call.sql.includes("INSERT INTO subjects"));
    assert.deepEqual(insert.params, [30, 40, "Psychologie de l’apprentissage"]);
  });
});

test("program manager cannot create a subject in another program", async () => {
  const pool = makePool({ allowed: false });
  await withApi(pool, async base => {
    const response = await fetch(base + "/program-manager/subjects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: 999, studyLevelId: 998, name: "Matière hors périmètre" })
    });
    assert.equal(response.status, 403);
    assert.equal(pool.calls.some(call => call.sql.includes("INSERT INTO subjects")), false);
  });
});

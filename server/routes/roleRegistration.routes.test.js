import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createRoleRegistrationRouter, normalizeProfessorApplications, normalizeRoleRequest } from "./roleRegistration.routes.js";

test("le professeur peut demander plusieurs cours dans des universités et programmes différents", () => {
  const applications = normalizeProfessorApplications([
    { universityId: 1, facultyId: 2, optionId: 3, studyLevelId: 4, courseId: 90 },
    { universityId: 5, facultyId: 6, optionId: 7, studyLevelId: 8, courseId: 91 }
  ]);
  assert.deepEqual(applications, [
    { role: "professor", universityId: 1, facultyId: 2, optionId: 3, studyLevelId: 4, courseId: 90 },
    { role: "professor", universityId: 5, facultyId: 6, optionId: 7, studyLevelId: 8, courseId: 91 }
  ]);
});

test("chaque demande professeur exige un cours et les cours répétés sont refusés", () => {
  assert.equal(normalizeProfessorApplications([
    { universityId: 1, facultyId: 2, optionId: 3, studyLevelId: 4, courseId: 90 },
    { universityId: 5, facultyId: 6, optionId: 7, studyLevelId: 8, courseId: 90 }
  ]), null);
  assert.equal(normalizeProfessorApplications([
    { universityId: 1, facultyId: 2, optionId: 3, studyLevelId: 4 }
  ]), null);
});

test("le formulaire accepte entre une et vingt demandes et refuse les listes excessives ou vides", () => {
  assert.equal(normalizeProfessorApplications([]), null);
  assert.equal(normalizeProfessorApplications(Array.from({ length: 21 }, (_,i) => ({
    universityId: 1, facultyId: 2, optionId: 3, studyLevelId: 4, courseId: i + 1
  }))), null);
});

test("le responsable d’université demande uniquement un périmètre universitaire", () => {
  assert.deepEqual(normalizeRoleRequest({ role: "university_admin", universityId: "9", facultyId: "2" }), {
    role: "university_admin", universityId: 9, facultyId: null, optionId: null, studyLevelId: null
  });
});

test("le responsable de faculté doit choisir une faculté", () => {
  assert.deepEqual(normalizeRoleRequest({ role: "faculty_manager", universityId: 9, facultyId: 8 }), {
    role: "faculty_manager", universityId: 9, facultyId: 8, optionId: null, studyLevelId: null
  });
  assert.equal(normalizeRoleRequest({ role: "faculty_manager", universityId: 9 }), null);
});

test("le responsable de programme choisit un programme et un niveau facultatif", () => {
  assert.deepEqual(normalizeRoleRequest({ role: "program_manager", universityId: 9, facultyId: 8, optionId: 3 }), {
    role: "program_manager", universityId: 9, facultyId: 8, optionId: 3, studyLevelId: null
  });
  assert.equal(normalizeRoleRequest({ role: "program_manager", universityId: 9, facultyId: 8 }), null);
});

test("les demandes publiques ne peuvent pas choisir un rôle général ou étudiant", () => {
  assert.equal(normalizeRoleRequest({ role: "admin_general", universityId: 9 }), null);
  assert.equal(normalizeRoleRequest({ role: "student", universityId: 9 }), null);
});


async function withApi(pool, run) {
  const app = express();
  app.use(createRoleRegistrationRouter({ pool }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("course catalog rejects an invalid study level before querying the database", async () => {
  let queries = 0;
  await withApi({ async query() { queries += 1; return { rows: [], rowCount: 0 }; } }, async base => {
    const response = await fetch(base + "/catalog/courses?studyLevelId=0");
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_study_level_id");
    assert.equal(queries, 0);
  });
});

test("course catalog returns only active courses in the selected active academic path with short public caching", async () => {
  let receivedSql = "";
  let receivedParams = [];
  const rows = [{ id: 202, name: "Psychologie de l’apprentissage", option_id: 1, study_level_id: 47 }];
  const pool = {
    async query(sql, params) {
      receivedSql = sql;
      receivedParams = params;
      return { rows, rowCount: rows.length };
    }
  };
  await withApi(pool, async base => {
    const response = await fetch(base + "/catalog/courses?studyLevelId=47");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, rows);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
    assert.match(receivedSql, /JOIN study_levels l ON l\.id=s\.study_level_id AND l\.option_id=s\.option_id/i);
    assert.match(receivedSql, /l\.is_active=TRUE AND o\.is_active=TRUE/i);
    assert.match(receivedSql, /c\.is_active=TRUE AND s\.is_active=TRUE/i);
    assert.deepEqual(receivedParams, [47]);
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { findActiveAcademicProfile, listActiveCoursesForStudyLevel, listActiveRoleUniversities, listProfessorUniversities, listRegistrableUniversities } from "./registrationCatalog.js";

test("student catalogue lists only active universities with an active administrator, registration enabled and a complete active path", async () => {
  let receivedSql = "";
  const rows = [{ id: 71, code: "READY", name: "Université prête" }];
  const result = await listRegistrableUniversities({
    async query(sql) { receivedSql = sql; return { rows, rowCount: rows.length }; }
  });
  assert.match(receivedSql, /u\.is_active\s*=\s*TRUE/i);
  assert.match(receivedSql, /u\.registration_enabled\s*=\s*TRUE/i);
  assert.match(receivedSql, /ra\.role='university_admin' AND ra\.status='active'/i);
  assert.match(receivedSql, /administrator\.is_active=TRUE/i);
  assert.match(receivedSql, /EXISTS\s*\([\s\S]*FROM faculties f[\s\S]*JOIN options o[\s\S]*JOIN study_levels l/i);
  assert.match(receivedSql, /f\.is_active\s*=\s*TRUE/i);
  assert.match(receivedSql, /o\.is_active\s*=\s*TRUE/i);
  assert.match(receivedSql, /l\.is_active\s*=\s*TRUE/i);
  assert.deepEqual(result.rows, rows);
});

test("role applications can list active universities before their catalog is ready", async () => {
  let receivedSql = "";
  const rows = [{ id: 72, code: "NEWUNI", name: "Nouvelle université" }];
  const result = await listActiveRoleUniversities({
    async query(sql) { receivedSql = sql; return { rows, rowCount: rows.length }; }
  });
  assert.match(receivedSql, /FROM universities WHERE is_active = TRUE ORDER BY name/i);
  assert.doesNotMatch(receivedSql, /registration_enabled/i);
  assert.deepEqual(result.rows, rows);
});

test("professor catalog lists only active universities that have an active course path", async () => {
  let receivedSql = "";
  const rows = [{ id: 73, code: "COURSES", name: "Université avec cours" }];
  const result = await listProfessorUniversities({
    async query(sql) { receivedSql = sql; return { rows, rowCount: rows.length }; }
  });
  assert.match(receivedSql, /JOIN subjects s ON s\.option_id=o\.id AND s\.study_level_id=l\.id/i);
  assert.match(receivedSql, /JOIN courses course ON course\.subject_id=s\.id/i);
  assert.match(receivedSql, /u\.is_active=TRUE/i);
  assert.deepEqual(result.rows, rows);
});

test("student registration requires a complete active path and an open university", async () => {
  let receivedSql = "";
  let receivedParams = [];
  const result = await findActiveAcademicProfile({
    async query(sql, params) { receivedSql = sql; receivedParams = params; return { rows: [], rowCount: 0 }; }
  }, {
    universityCode: "NEWUNI", facultyCode: "SCI", optionCode: "PSY", studyLevelCode: "L1"
  });
  assert.match(receivedSql, /JOIN faculties f ON f\.university_id=u\.id/i);
  assert.match(receivedSql, /JOIN options o ON o\.faculty_id=f\.id/i);
  assert.match(receivedSql, /JOIN study_levels l ON l\.option_id=o\.id/i);
  assert.match(receivedSql, /u\.is_active=TRUE/i);
  assert.match(receivedSql, /u\.registration_enabled=TRUE/i);
  assert.match(receivedSql, /ra\.role='university_admin' AND ra\.status='active'/i);
  assert.match(receivedSql, /f\.is_active=TRUE/i);
  assert.match(receivedSql, /o\.is_active=TRUE/i);
  assert.match(receivedSql, /l\.is_active=TRUE/i);
  assert.deepEqual(receivedParams, ["NEWUNI", "SCI", "PSY", "L1"]);
  assert.equal(result.rowCount, 0);
});


test("course catalog returns only active courses within the selected active academic path", async () => {
  let receivedSql = "";
  let receivedParams = [];
  const rows = [{ id: 202, name: "Psychologie de l’apprentissage" }];
  const result = await listActiveCoursesForStudyLevel({
    async query(sql, params) {
      receivedSql = sql;
      receivedParams = params;
      return { rows, rowCount: rows.length };
    }
  }, 47);

  assert.match(receivedSql, /JOIN subjects s ON s\.id=c\.subject_id/i);
  assert.match(receivedSql, /JOIN study_levels l ON l\.id=s\.study_level_id/i);
  assert.match(receivedSql, /JOIN options o ON o\.id=s\.option_id AND o\.id=l\.option_id/i);
  assert.match(receivedSql, /c\.is_active=TRUE AND s\.is_active=TRUE AND l\.is_active=TRUE/i);
  assert.match(receivedSql, /o\.is_active=TRUE AND f\.is_active=TRUE AND u\.is_active=TRUE/i);
  assert.deepEqual(receivedParams, [47]);
  assert.deepEqual(result.rows, rows);
});

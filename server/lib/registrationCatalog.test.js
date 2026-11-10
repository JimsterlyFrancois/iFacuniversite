import test from "node:test";
import assert from "node:assert/strict";
import { findActiveAcademicProfile, listRegistrableUniversities } from "./registrationCatalog.js";

test("active universities are listed even while their academic catalogue is incomplete", async () => {
  let receivedSql = "";
  const rows = [{ id: 71, code: "NEWUNI", name: "Nouvelle université", registration_enabled: false }];
  const result = await listRegistrableUniversities({
    async query(sql) {
      receivedSql = sql;
      return { rows, rowCount: rows.length };
    }
  });

  assert.match(receivedSql, /FROM universities WHERE is_active = TRUE ORDER BY name/i);
  assert.doesNotMatch(receivedSql, /registration_enabled/i);
  assert.deepEqual(result.rows, rows);
});

test("student registration still requires a complete active university-faculty-option-level path", async () => {
  let receivedSql = "";
  let receivedParams = [];
  const result = await findActiveAcademicProfile({
    async query(sql, params) {
      receivedSql = sql;
      receivedParams = params;
      return { rows: [], rowCount: 0 };
    }
  }, {
    universityCode: "NEWUNI",
    facultyCode: "SCI",
    optionCode: "PSY",
    studyLevelCode: "L1"
  });

  assert.match(receivedSql, /JOIN faculties f ON f\.university_id=u\.id/i);
  assert.match(receivedSql, /JOIN options o ON o\.faculty_id=f\.id/i);
  assert.match(receivedSql, /JOIN study_levels l ON l\.option_id=o\.id/i);
  assert.match(receivedSql, /u\.is_active=TRUE/i);
  assert.match(receivedSql, /f\.is_active=TRUE/i);
  assert.match(receivedSql, /o\.is_active=TRUE/i);
  assert.match(receivedSql, /l\.is_active=TRUE/i);
  assert.doesNotMatch(receivedSql, /registration_enabled/i);
  assert.deepEqual(receivedParams, ["NEWUNI", "SCI", "PSY", "L1"]);
  assert.equal(result.rowCount, 0);
});

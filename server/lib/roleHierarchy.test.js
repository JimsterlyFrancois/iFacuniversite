import test from "node:test";
import assert from "node:assert/strict";
import { hasActiveRoleApprover, roleApproverMessage } from "./roleHierarchy.js";

function queryable(rowCount) {
  return { calls: [], async query(sql, params) { this.calls.push({ sql, params }); return { rowCount, rows: rowCount ? [{}] : [] }; } };
}

test("a faculty manager application requires an active university administrator", async () => {
  const db = queryable(0);
  const approved = await hasActiveRoleApprover(db, { role: "faculty_manager", universityId: 9 });
  assert.equal(approved, false);
  assert.match(db.calls[0].sql, /role=\$1 AND ra\.status='active'/);
  assert.deepEqual(db.calls[0].params, ["university_admin", 9]);
  assert.match(roleApproverMessage("faculty_manager"), /responsable d’université actif/i);
});

test("a program manager application requires an active faculty manager in the same faculty", async () => {
  const db = queryable(1);
  const approved = await hasActiveRoleApprover(db, { role: "program_manager", universityId: 9, facultyId: 4 });
  assert.equal(approved, true);
  assert.deepEqual(db.calls[0].params, ["faculty_manager", 9, 4]);
  assert.match(db.calls[0].sql, /ra\.faculty_id=\$3/);
});

test("a professor course request requires an active program manager covering that option and level", async () => {
  const db = queryable(0);
  const approved = await hasActiveRoleApprover(db, { role: "professor", universityId: 9, facultyId: 4, optionId: 7, studyLevelId: 12 });
  assert.equal(approved, false);
  assert.deepEqual(db.calls[0].params, ["program_manager", 9, 4, 7, 12]);
  assert.match(db.calls[0].sql, /ra\.option_id=\$4/);
  assert.match(db.calls[0].sql, /ra\.study_level_id IS NULL OR ra\.study_level_id=\$5/);
  assert.match(roleApproverMessage("professor"), /responsable de programme actif/i);
});

test("global or top-level role requests do not need an additional approver", async () => {
  const db = queryable(0);
  assert.equal(await hasActiveRoleApprover(db, { role: "university_admin", universityId: 9 }), true);
  assert.equal(db.calls.length, 0);
});

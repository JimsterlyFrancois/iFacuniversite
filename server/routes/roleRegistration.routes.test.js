import test from "node:test";
import assert from "node:assert/strict";
import { normalizeResponsibleScope } from "./roleRegistration.routes.js";

test("responsable d’université : périmètre limité à l’université", () => {
  assert.deepEqual(normalizeResponsibleScope({ role: "university_admin", universityId: "4", facultyId: "2" }),
    { role: "university_admin", universityId: 4, facultyId: null, optionId: null, studyLevelId: null });
});
test("responsable de faculté : université et faculté obligatoires", () => {
  assert.deepEqual(normalizeResponsibleScope({ role: "faculty_manager", universityId: "4", facultyId: "2" }),
    { role: "faculty_manager", universityId: 4, facultyId: 2, optionId: null, studyLevelId: null });
  assert.equal(normalizeResponsibleScope({ role: "faculty_manager", universityId: "4" }), null);
});
test("responsable de programme : option obligatoire et niveau facultatif", () => {
  assert.deepEqual(normalizeResponsibleScope({ role: "program_manager", universityId: 4, facultyId: 2, optionId: 9, studyLevelId: 3 }),
    { role: "program_manager", universityId: 4, facultyId: 2, optionId: 9, studyLevelId: 3 });
  assert.equal(normalizeResponsibleScope({ role: "program_manager", universityId: 4, facultyId: 2 }), null);
});
test("le formulaire public refuse les rôles globaux ou hors périmètre", () => {
  for (const role of ["admin_general", "professor", "student", "delegate"]) {
    assert.equal(normalizeResponsibleScope({ role, universityId: 4, facultyId: 2, optionId: 3 }), null);
  }
});

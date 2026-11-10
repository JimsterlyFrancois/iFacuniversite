import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProfessorApplications, normalizeRoleRequest } from "./roleRegistration.routes.js";

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

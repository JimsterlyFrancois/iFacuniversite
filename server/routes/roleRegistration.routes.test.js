import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoleRequest } from "./roleRegistration.routes.js";

test("le professeur doit choisir une université, une faculté, un programme et un niveau", () => {
  assert.deepEqual(normalizeRoleRequest({
    role:"professor",universityId:"1",facultyId:"2",optionId:"3",studyLevelId:"4"
  }), { role:"professor",universityId:1,facultyId:2,optionId:3,studyLevelId:4 });
  assert.equal(normalizeRoleRequest({role:"professor",universityId:1,facultyId:2,optionId:3}),null);
});

test("le responsable d’université demande uniquement un périmètre universitaire", () => {
  assert.deepEqual(normalizeRoleRequest({role:"university_admin",universityId:"9",facultyId:"2"}), {
    role:"university_admin",universityId:9,facultyId:null,optionId:null,studyLevelId:null
  });
});

test("le responsable de faculté doit choisir une faculté", () => {
  assert.deepEqual(normalizeRoleRequest({role:"faculty_manager",universityId:9,facultyId:8}), {
    role:"faculty_manager",universityId:9,facultyId:8,optionId:null,studyLevelId:null
  });
  assert.equal(normalizeRoleRequest({role:"faculty_manager",universityId:9}),null);
});

test("le responsable de programme choisit un programme et un niveau facultatif", () => {
  assert.deepEqual(normalizeRoleRequest({role:"program_manager",universityId:9,facultyId:8,optionId:3}), {
    role:"program_manager",universityId:9,facultyId:8,optionId:3,studyLevelId:null
  });
  assert.equal(normalizeRoleRequest({role:"program_manager",universityId:9,facultyId:8}),null);
});

test("les demandes publiques ne peuvent pas choisir un rôle général ou étudiant", () => {
  assert.equal(normalizeRoleRequest({role:"admin_general",universityId:9}),null);
  assert.equal(normalizeRoleRequest({role:"student",universityId:9}),null);
  assert.equal(normalizeRoleRequest({role:"professor",universityId:1,facultyId:2,optionId:3,studyLevelId:"invalid"}),null);
});

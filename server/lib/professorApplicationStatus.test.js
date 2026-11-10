import test from "node:test";
import assert from "node:assert/strict";
import { deriveProfessorRoleStatus } from "./professorApplicationStatus.js";

test("a professor stays active while at least one course request is approved",()=>{
  assert.equal(deriveProfessorRoleStatus(1,3),"active");
  assert.equal(deriveProfessorRoleStatus(2,0),"active");
});
test("a professor with only pending requests keeps a pending role",()=>{
  assert.equal(deriveProfessorRoleStatus(0,2),"pending");
});
test("a professor is revoked only after all requests are rejected or inactive",()=>{
  assert.equal(deriveProfessorRoleStatus(0,0),"revoked");
});

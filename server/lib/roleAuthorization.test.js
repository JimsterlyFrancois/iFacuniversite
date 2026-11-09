import test from "node:test";
import assert from "node:assert/strict";
import { hasActiveRole, isGeneralAdmin, requireGeneralAdmin } from "./roleAuthorization.js";
const response=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test("an active admin_general assignment grants global access to a student base account",()=>{
 const req={user:{role:"student"},activeRoles:["admin_general"]},res=response();let next=false;
 assert.equal(isGeneralAdmin(req),true);requireGeneralAdmin(req,res,()=>{next=true;});assert.equal(next,true);assert.equal(req.isAdminGeneral,true);
});
test("legacy base admins retain platform access",()=>assert.equal(isGeneralAdmin({user:{role:"admin"},activeRoles:[]}),true));
for(const role of ["university_admin","faculty_manager","program_manager","professor","student","delegate"]){
 test(role+" cannot inherit global privileges",()=>{
  const req={user:{role:role==="delegate"?"student":role},activeRoles:[role]},res=response();let next=false;
  assert.equal(isGeneralAdmin(req),false);requireGeneralAdmin(req,res,()=>{next=true;});
  assert.equal(next,false);assert.equal(res.statusCode,403);assert.equal(res.body.error,"administrator_required");
 });
}
test("revoked assignments and empty database assignment sets do not grant professor access",()=>{
 assert.equal(hasActiveRole({user:{role:"student"},roleAssignments:[{role:"professor",status:"revoked"}]},"professor"),false);
 assert.equal(hasActiveRole({user:{role:"professor"},activeRoles:[]},"professor"),false);
});

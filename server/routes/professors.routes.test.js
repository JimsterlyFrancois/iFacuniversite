import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createProfessorsRouter } from "./professors.routes.js";
import { requireGeneralAdmin } from "../lib/roleAuthorization.js";
async function api({pool,role="student",activeRoles=[]},run){
 const app=express();app.use(express.json());
 const auth=(req,_res,next)=>{req.user={id:52,role};req.activeRoles=activeRoles;next();};
 app.use(createProfessorsRouter({pool,requireAuth:auth,requireAdmin:requireGeneralAdmin}));
 const server=createServer(app);await new Promise(r=>server.listen(0,"127.0.0.1",r));const address=server.address();
 try{await run("http://127.0.0.1:"+address.port);}finally{await new Promise((r,j)=>server.close(e=>e?j(e):r()));}
}
test("professor space reads active course assignments with a student base role",async()=>{
 const calls=[],pool={async query(sql,params=[]){calls.push({sql,params});return sql.includes("SELECT u.name AS university_name")?{rows:[{course_id:91}],rowCount:1}:{rows:[],rowCount:0};}};
 await api({pool,role:"student",activeRoles:["professor"]},async base=>{
  const r=await fetch(base+"/professor/assignments");assert.equal(r.status,200);assert.equal((await r.json()).data[0].course_id,91);
  assert.ok(calls.some(c=>c.sql.includes("role='professor' AND ra.status='active'")));
 });
});
test("a student without an active professor role is denied",async()=>{
 let queried=false;const pool={async query(){queried=true;return {rows:[],rowCount:0};}};
 await api({pool},async base=>{assert.equal((await fetch(base+"/professor/assignments")).status,403);assert.equal(queried,false);});
});
test("admin_general can manage the global professor directory",async()=>{
 const pool={async query(sql){return sql.startsWith("CREATE TABLE")?{rows:[],rowCount:0}:{rows:[],rowCount:0};}};
 await api({pool,activeRoles:["admin_general"]},async base=>assert.equal((await fetch(base+"/admin/professors")).status,200));
});
test("faculty_manager cannot access global professor management routes",async()=>{
 let queried=false;const pool={async query(){queried=true;return {rows:[],rowCount:0};}};
 await api({pool,activeRoles:["faculty_manager"]},async base=>{assert.equal((await fetch(base+"/admin/professors")).status,403);assert.equal(queried,false);});
});

test("an active professor can submit a separate course request in another university and program",async()=>{
 const calls=[];
 const pool={
  async query(sql,params=[]){calls.push({sql,params});return {rows:[],rowCount:0};},
  async connect(){
   return {
    async query(sql,params=[]){
     calls.push({sql,params});
     if(sql.includes("SELECT id FROM professor_invites WHERE user_id=$1"))return {rows:[{id:77}],rowCount:1};
     if(sql.includes("SELECT c.id FROM courses c"))return {rows:[{id:901}],rowCount:1};
     if(sql.includes("SELECT id FROM professor_assignments WHERE invite_id=$1 AND ((requested_course_id=$2"))return {rows:[],rowCount:0};
     if(sql.includes("INSERT INTO professor_assignments"))return {rows:[{id:501}],rowCount:1};
     return {rows:[],rowCount:1};
    },
    release(){}
   };
  }
 };
 await api({pool,role:"applicant",activeRoles:["professor"]},async base=>{
  const response=await fetch(base+"/professor/applications",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({universityId:5,facultyId:6,optionId:7,studyLevelId:8,courseId:901})
  });
  assert.equal(response.status,201);
  const body=await response.json();
  assert.equal(body.applicationId,501);
  const insert=calls.find(call=>call.sql.includes("INSERT INTO professor_assignments"));
  assert.deepEqual(insert.params,[77,5,6,7,8,901]);
  assert.ok(calls.some(call=>call.sql.includes("INSERT INTO admin_audit_logs")));
 });
});

test("professor cannot request a course outside the selected university/faculty/program/level",async()=>{
 const calls=[];
 const pool={
  async query(sql,params=[]){calls.push({sql,params});return {rows:[],rowCount:0};},
  async connect(){
   return {
    async query(sql,params=[]){
     calls.push({sql,params});
     if(sql.includes("SELECT id FROM professor_invites WHERE user_id=$1"))return {rows:[{id:77}],rowCount:1};
     if(sql.includes("SELECT c.id FROM courses c"))return {rows:[],rowCount:0};
     return {rows:[],rowCount:1};
    },
    release(){}
   };
  }
 };
 await api({pool,activeRoles:["professor"]},async base=>{
  const response=await fetch(base+"/professor/applications",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({universityId:5,facultyId:6,optionId:7,studyLevelId:8,courseId:999})
  });
  assert.equal(response.status,400);
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO professor_assignments")),false);
 });
});

test("professor cannot submit the same requested course twice while it is pending or approved",async()=>{
 const calls=[];
 const pool={
  async query(sql,params=[]){calls.push({sql,params});return {rows:[],rowCount:0};},
  async connect(){
   return {
    async query(sql,params=[]){
     calls.push({sql,params});
     if(sql.includes("SELECT id FROM professor_invites WHERE user_id=$1"))return {rows:[{id:77}],rowCount:1};
     if(sql.includes("SELECT c.id FROM courses c"))return {rows:[{id:901}],rowCount:1};
     if(sql.includes("SELECT id FROM professor_assignments WHERE invite_id=$1 AND ((requested_course_id=$2"))return {rows:[{id:500}],rowCount:1};
     return {rows:[],rowCount:1};
    },
    release(){}
   };
  }
 };
 await api({pool,activeRoles:["professor"]},async base=>{
  const response=await fetch(base+"/professor/applications",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({universityId:5,facultyId:6,optionId:7,studyLevelId:8,courseId:901})
  });
  assert.equal(response.status,409);
  assert.equal(calls.some(call=>call.sql.includes("INSERT INTO professor_assignments")),false);
 });
});

test("a student without professor role cannot create additional professor applications",async()=>{
 let queried=false;
 const pool={async query(){queried=true;return {rows:[],rowCount:0};}};
 await api({pool,activeRoles:[]},async base=>{
  const response=await fetch(base+"/professor/applications",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({universityId:1,facultyId:2,optionId:3,studyLevelId:4,courseId:5})
  });
  assert.equal(response.status,403);
  assert.equal(queried,false);
 });
});

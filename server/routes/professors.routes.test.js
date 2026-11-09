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

test("professor self-registration requires a valid university and academic path",async()=>{
 let queried=false;const pool={async query(){queried=true;return {rows:[],rowCount:0};}};
 await api({pool},async base=>{
  const response=await fetch(base+"/auth/professor/register",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({firstName:"Jean",lastName:"Pierre",email:"jean@example.com",password:"secure-pass-123"})
  });
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,"invalid_professor_registration");
  assert.equal(queried,false);
 });
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createClassDocumentsRouter } from "./classDocuments.routes.js";
import { requireGeneralAdmin } from "../lib/roleAuthorization.js";
async function api({pool,role="student",activeRoles=[]},run){
 const app=express();app.use(express.json());
 const auth=(req,_res,next)=>{req.user={id:41,role,university_id:10,faculty_id:20,option_id:30,study_level_id:40};req.activeRoles=activeRoles;next();};
 app.use(createClassDocumentsRouter({pool,requireAuth:auth,requireAdmin:requireGeneralAdmin,storePrivateObject:async()=>{},readPrivateObject:async()=>Buffer.alloc(0),deletePrivateObject:async()=>{}}));
 const server=createServer(app);await new Promise(r=>server.listen(0,"127.0.0.1",r));const address=server.address();
 try{await run("http://127.0.0.1:"+address.port);}finally{await new Promise((r,j)=>server.close(e=>e?j(e):r()));}
}
test("admin_general receives a cross-university result set on the legacy class route",async()=>{
 let call;const pool={async query(sql,params){call={sql,params};return {rows:[{university_id:10},{university_id:22}],rowCount:2};}};
 await api({pool,activeRoles:["admin_general"]},async base=>{
  const r=await fetch(base+"/admin/classes");assert.equal(r.status,200);assert.equal((await r.json()).data.length,2);
  assert.deepEqual(call.params,[null]);assert.match(call.sql,/\(\$1::bigint IS NULL OR u\.id=\$1\)/);
 });
});
test("university_admin cannot use a global legacy route",async()=>{
 let queried=false;const pool={async query(){queried=true;return {rows:[],rowCount:0};}};
 await api({pool,activeRoles:["university_admin"]},async base=>{assert.equal((await fetch(base+"/admin/classes")).status,403);assert.equal(queried,false);});
});
test("active professor assignments work when the login base role is student",async()=>{
 let call;const pool={async query(sql,params){call={sql,params};return {rows:[{id:55}],rowCount:1};}};
 await api({pool,role:"student",activeRoles:["professor"]},async base=>{
  assert.equal((await fetch(base+"/class-documents")).status,200);assert.match(call.sql,/professor_assignments/);assert.deepEqual(call.params,[41]);
 });
});
test("student document listing applies global, university, faculty and program publication scopes",async()=>{
 let call;const pool={async query(sql,params){call={sql,params};return {rows:[],rowCount:0};}};
 await api({pool},async base=>{
  assert.equal((await fetch(base+"/class-documents")).status,200);
  for(const scope of ["global","university","faculty","program"])assert.ok(call.sql.includes("publication_scope='"+scope+"'"));
  assert.deepEqual(call.params,[10,20,30,40]);
 });
});

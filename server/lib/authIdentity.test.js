import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthUserId } from "./authIdentity.js";
test("password reset reuses a linked Supabase Auth identity without a lookup",async()=>{
 const calls=[],id="a2e3d11c-726c-4b1c-9c21-6a8a2e1f0001",client={async query(...a){calls.push(a);return {rows:[]};}};
 assert.equal(await resolveAuthUserId(client,12,id),id);assert.equal(calls.length,0);
});
test("password reset repairs a missing link by matching the Auth email",async()=>{
 const calls=[],id="a2e3d11c-726c-4b1c-9c21-6a8a2e1f0002";
 const client={async query(sql,params){calls.push({sql,params});return sql.startsWith("SELECT")?{rows:[{id}],rowCount:1}:{rows:[],rowCount:1};}};
 assert.equal(await resolveAuthUserId(client,13,null),id);assert.equal(calls.length,2);assert.deepEqual(calls[1].params,[id,13]);
 assert.match(calls[1].sql,/UPDATE users SET auth_user_id/);
});
test("password reset supports legacy accounts without an Auth identity",async()=>{
 assert.equal(await resolveAuthUserId({async query(){return {rows:[],rowCount:0};}},14,null),null);
});

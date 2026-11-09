import test from "node:test";
import assert from "node:assert/strict";
import { updateSupabaseUserPassword } from "./supabaseAdmin.js";

test("password updates use the server-only Supabase Auth admin endpoint", async () => {
  let request;
  const result = await updateSupabaseUserPassword({
    supabaseUrl: "https://project.supabase.co/",
    secretKey: "server-secret",
    userId: "f8d2f2d0-55d8-4d33-9c0a-8f5b1e1f1234",
    password: "A-new-password-123",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200 };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(request.url, "https://project.supabase.co/auth/v1/admin/users/f8d2f2d0-55d8-4d33-9c0a-8f5b1e1f1234");
  assert.equal(request.options.method, "PUT");
  assert.equal(request.options.headers.apikey, "server-secret");
  assert.equal(request.options.headers.Authorization, "Bearer server-secret");
  assert.deepEqual(JSON.parse(request.options.body), { password: "A-new-password-123" });
});

test("password update fails closed when the server secret is missing", async () => {
  const result = await updateSupabaseUserPassword({
    supabaseUrl: "https://project.supabase.co",
    secretKey: "",
    userId: "f8d2f2d0-55d8-4d33-9c0a-8f5b1e1f1234",
    password: "A-new-password-123",
    fetchImpl: async () => { throw new Error("must not call fetch"); }
  });
  assert.deepEqual(result, { ok: false, status: 0 });
});
